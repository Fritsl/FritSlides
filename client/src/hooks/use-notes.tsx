import { useQuery, useMutation } from "@tanstack/react-query";
import { Note, InsertNote, UpdateNote } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useState, useCallback, createContext, useContext } from "react";
import { getSupabaseClient } from "@/lib/supabase";

// Helper function to find a note by ID in a list
const findNoteById = (notes: Note[], id: number): Note | undefined => {
  return notes.find(note => note.id === id);
};

// Helper function to clone notes array and update a specific note
const updateNoteInList = (notes: Note[], updatedNote: Partial<Note> & { id: number }): Note[] => {
  return notes.map(note => 
    note.id === updatedNote.id 
      ? { ...note, ...updatedNote } 
      : note
  );
};

// Helper function to handle optimistic creation of a note with a temporary ID
const createOptimisticNote = (note: Partial<InsertNote>, projectId: number, existingNotes: Note[] = []): Note => {
  // Generate a temporary negative ID to avoid conflicts with real IDs
  const tempId = -Math.floor(Math.random() * 1000000);
  const now = new Date();
  
  // Calculate the highest order for notes with the same parent
  let maxOrder = -1;
  const parentId = typeof note.parentId === 'number' ? note.parentId : null;
  
  if (existingNotes.length > 0) {
    // Find all notes with the same parent
    const siblingNotes = existingNotes.filter(n => 
      (n.parentId === null && parentId === null) || 
      (n.parentId === parentId)
    );
    
    // Find the maximum order value
    if (siblingNotes.length > 0) {
      maxOrder = Math.max(...siblingNotes.map(n => parseFloat(String(n.order))));
    }
  }
  
  // New note should have an order value higher than any existing note
  const newOrder = maxOrder + 1;
  
  // Create an optimistic note with explicit type casting to fix type errors
  return {
    id: tempId,
    projectId: projectId,
    parentId: parentId,
    content: typeof note.content === 'string' ? note.content : "",
    url: typeof note.url === 'string' ? note.url : null,
    linkText: typeof note.linkText === 'string' ? note.linkText : null,
    youtubeLink: typeof note.youtubeLink === 'string' ? note.youtubeLink : null,
    time: typeof note.time === 'string' ? note.time : null,
    isDiscussion: typeof note.isDiscussion === 'boolean' ? note.isDiscussion : null,
    images: Array.isArray(note.images) ? note.images.filter(img => typeof img === 'string') as string[] : null,
    // Always ensure order is stored as a number
    order: typeof note.order === 'number' ? note.order : 
           typeof note.order === 'string' ? parseFloat(note.order) || newOrder : 
           newOrder
  };
};

// Create a context to track which note is currently being edited across components
interface EditingContext {
  editingNoteId: number | null;
  setEditingNoteId: (id: number | null) => void;
  isEditing: boolean;
}

const NoteEditingContext = createContext<EditingContext | null>(null);

// Provider component for the editing state
export function NoteEditingProvider({ children }: { children: React.ReactNode }) {
  // Check URL for noteId parameter when component mounts
  const [editingNoteId, setEditingNoteId] = useState<number | null>(() => {
    // Get noteId from URL if available
    const params = new URLSearchParams(window.location.search);
    const noteIdParam = params.get('noteId');
    const fromPresent = params.get('fromPresent');
    
    // If coming from presentation mode (fromPresent=true), don't start editing
    if (fromPresent === 'true') {
      return null;
    }
    
    // Otherwise, parse the noteId parameter if available
    if (noteIdParam) {
      try {
        const noteId = parseInt(noteIdParam, 10);
        return isNaN(noteId) ? null : noteId;
      } catch (e) {
        return null;
      }
    }
    return null;
  });
  
  const context = {
    editingNoteId,
    setEditingNoteId,
    isEditing: editingNoteId !== null
  };
  
  return (
    <NoteEditingContext.Provider value={context}>
      {children}
    </NoteEditingContext.Provider>
  );
}

// Hook to access the editing state
export function useNoteEditing() {
  const context = useContext(NoteEditingContext);
  if (!context) {
    throw new Error("useNoteEditing must be used within a NoteEditingProvider");
  }
  return context;
}

export function useNotes(projectId: number | null) {
  const { toast } = useToast();
  const { editingNoteId, setEditingNoteId, isEditing } = useNoteEditing();
  
  // Function to start editing a note - ensures only one note can be edited at a time
  const startEditing = useCallback((noteId: number) => {
    console.log(`[EDITING] Starting edit mode for note ${noteId}`);
    
    // If already editing a different note, show a warning
    if (editingNoteId !== null && editingNoteId !== noteId) {
      toast({
        title: "Already editing",
        description: "Please finish editing the current note before editing another one.",
        variant: "destructive",
      });
      return false;
    }
    
    setEditingNoteId(noteId);
    return true;
  }, [editingNoteId, setEditingNoteId, toast]);
  
  // Function to stop editing 
  const stopEditing = useCallback(() => {
    console.log(`[EDITING] Exiting edit mode`);
    setEditingNoteId(null);
  }, [setEditingNoteId]);
  
  const {
    data: notes,
    isLoading,
    error,
  } = useQuery<Note[]>({
    queryKey: projectId ? [`/api/projects/${projectId}/notes`] : [null],
    enabled: !!projectId,
  });

  const createNote = useMutation({
    mutationFn: async (note: Partial<InsertNote>) => {
      if (!projectId && !note.projectId) throw new Error("Project ID is required");
      const targetProjectId = projectId || note.projectId;
      
      // Add a 'fastCreate' flag to signal server we want a rapid creation without normalization
      const noteWithFlag = { ...note, fastCreate: true };
      
      // Use AbortController to add a timeout for the request
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
      
      try {
        const res = await apiRequest("POST", `/api/projects/${targetProjectId}/notes`, noteWithFlag, {
          signal: controller.signal
        });
        clearTimeout(timeoutId);
        return res.json();
      } catch (err) {
        clearTimeout(timeoutId);
        throw err;
      }
    },
    onMutate: async (newNote: Partial<InsertNote>) => {
      console.log(`[CREATE MUTATE] Starting optimistic update for new note`, newNote);
      
      // Skip optimistic update if we don't have the notes data yet
      if (!notes || !projectId) {
        console.log(`[CREATE MUTATE] Skipping optimistic update - no notes or projectId available`);
        return;
      }
      
      // IMPORTANT CHANGE: Clear localStorage flags to avoid edit mode during optimistic update
      // We'll wait for server confirmation before entering edit mode
      localStorage.removeItem('newNoteCreated');
      localStorage.removeItem('lastCreatedNoteId');
      console.log(`[CREATE MUTATE] Cleared localStorage flags to prevent premature edit mode`);
      
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: [`/api/projects/${projectId}/notes`] });
      
      // Snapshot the previous value
      const previousNotes = queryClient.getQueryData<Note[]>([`/api/projects/${projectId}/notes`]);
      
      // Create an optimistic note with the previous notes to calculate proper order
      const optimisticNote = createOptimisticNote(newNote, projectId, previousNotes || []);
      console.log(`[CREATE MUTATE] Created optimistic note with temp ID: ${optimisticNote.id}, order: ${optimisticNote.order}`);
      
      // Optimistically update the UI
      if (previousNotes) {
        queryClient.setQueryData<Note[]>(
          [`/api/projects/${projectId}/notes`], 
          [...previousNotes, optimisticNote]
        );
        console.log(`[CREATE MUTATE] Updated query cache with optimistic note`);
      }
      
      return { previousNotes, optimisticNote };
    },
    onSuccess: (data, variables, context) => {
      console.log(`[CREATE SUCCESS] Server created note with ID: ${data.id}`, data);
      
      // Set edit mode flags immediately to reduce perceived lag
      localStorage.setItem('newNoteCreated', 'true');
      localStorage.setItem('lastCreatedNoteId', data.id.toString());
      
      // No need to invalidate manually since we'll update the cache with the server response
      if (projectId) {
        // Get the current notes
        const currentNotes = queryClient.getQueryData<Note[]>([`/api/projects/${projectId}/notes`]);
        
        if (currentNotes && context?.optimisticNote) {
          console.log(`[CREATE SUCCESS] Replacing optimistic note ${context.optimisticNote.id} with real note ${data.id}`);
          
          // Replace the optimistic note with the real one
          const updatedNotes = currentNotes.map(note => {
            if (note.id === context.optimisticNote.id) {
              console.log(`[CREATE SUCCESS] Setting up edit mode for new note ${data.id}`);
              return data;
            }
            return note;
          });
          
          // Update the cache with the real note
          queryClient.setQueryData<Note[]>([`/api/projects/${projectId}/notes`], updatedNotes);
          console.log(`[CREATE SUCCESS] Updated query cache with real note`);
          
          // Immediately invalidate the query to trigger a re-render that will pick up the localStorage flags
          console.log(`[CREATE SUCCESS] Invalidating query to trigger UI update and enter edit mode`);
          queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/notes`] });
        } else {
          // Fallback to invalidating if something went wrong
          console.log(`[CREATE SUCCESS] No optimistic note found, invalidating query`);
          queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/notes`] });
        }
      }
    },
    onError: (error, variables, context) => {
      // If the mutation fails, roll back to the previous notes
      if (context?.previousNotes && projectId) {
        queryClient.setQueryData<Note[]>([`/api/projects/${projectId}/notes`], context.previousNotes);
      }
      
      toast({
        title: "Failed to create note",
        description: error.message,
        variant: "destructive",
      });
    },
    onSettled: () => {
      // Don't invalidate immediately after settling to avoid extra server round trips
      // This helps with performance and reduces server load
    }
  });

  const updateNote = useMutation({
    mutationFn: async ({ id, ...note }: Partial<UpdateNote> & { id: number }) => {
      console.log(`[UPDATE API] Starting API request for note ${id} with data:`, note);
      const res = await apiRequest("PUT", `/api/notes/${id}`, note);
      const result = await res.json();
      console.log(`[UPDATE API] Received API response for note ${id}:`, result);
      return result;
    },
    onMutate: async (updatedNote: Partial<UpdateNote> & { id: number }) => {
      console.log(`[UPDATE MUTATE] Starting optimistic update for note ${updatedNote.id}`);
      
      // Skip optimistic update if we don't have the notes data yet
      if (!notes || !projectId) {
        console.log(`[UPDATE MUTATE] Skipping optimistic update - no notes or projectId available`);
        return;
      }
      
      // Cancel any outgoing refetches
      console.log(`[UPDATE MUTATE] Canceling existing queries for project ${projectId}`);
      await queryClient.cancelQueries({ queryKey: [`/api/projects/${projectId}/notes`] });
      
      // Snapshot the previous value
      const previousNotes = queryClient.getQueryData<Note[]>([`/api/projects/${projectId}/notes`]);
      console.log(`[UPDATE MUTATE] Previous notes snapshot taken, count: ${previousNotes?.length || 0}`);
      
      // Optimistically update the UI
      if (previousNotes) {
        console.log(`[UPDATE MUTATE] Applying optimistic update for note ${updatedNote.id}`);
        const updatedNotes = updateNoteInList(previousNotes, updatedNote);
        queryClient.setQueryData<Note[]>([`/api/projects/${projectId}/notes`], updatedNotes);
        console.log(`[UPDATE MUTATE] Optimistic update applied successfully`);
      }
      
      return { previousNotes };
    },
    onSuccess: (data, variables) => {
      console.log(`[UPDATE SUCCESS] Update succeeded for note ${variables.id}`, data);
      // Success toast removed to avoid disrupting the user's flow
      // This makes the app feel more responsive and less "noisy"
    },
    onError: (error, variables, context) => {
      console.log(`[UPDATE ERROR] Failed to update note ${variables.id}:`, error);
      // If the mutation fails, roll back to the previous notes
      if (context?.previousNotes && projectId) {
        console.log(`[UPDATE ERROR] Rolling back to previous state`);
        queryClient.setQueryData<Note[]>([`/api/projects/${projectId}/notes`], context.previousNotes);
      }
      
      toast({
        title: "Failed to update note",
        description: error.message,
        variant: "destructive",
      });
    },
    onSettled: (data, error, variables) => {
      console.log(`[UPDATE SETTLED] Update operation completed for note ${variables.id}, success=${!error}`);
      if (projectId) {
        console.log(`[UPDATE SETTLED] Invalidating query cache to ensure we're in sync with server`);
        queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/notes`] });
      }
    }
  });

  const deleteNote = useMutation({
    mutationFn: async ({ id, deleteChildren }: { id: number, deleteChildren: boolean }) => {
      await apiRequest("DELETE", `/api/notes/${id}?deleteChildren=${deleteChildren}`);
    },
    onMutate: async ({ id, deleteChildren }) => {
      // Skip optimistic update if we don't have the notes data yet
      if (!notes || !projectId) return;
      
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: [`/api/projects/${projectId}/notes`] });
      
      // Snapshot the previous value
      const previousNotes = queryClient.getQueryData<Note[]>([`/api/projects/${projectId}/notes`]);
      
      // Optimistically update the UI
      if (previousNotes) {
        let updatedNotes;
        
        if (deleteChildren) {
          // Remove the note and all its children
          updatedNotes = previousNotes.filter(note => {
            // Determine if this note is a descendant of the deleted note
            let current = note;
            while (current.parentId !== null) {
              if (current.parentId === id) return false;
              const parent = previousNotes.find(n => n.id === current.parentId);
              if (!parent) break;
              current = parent;
            }
            return note.id !== id;
          });
        } else {
          // Only remove the note itself, children will be updated by the server
          updatedNotes = previousNotes.filter(note => note.id !== id);
        }
        
        queryClient.setQueryData<Note[]>([`/api/projects/${projectId}/notes`], updatedNotes);
      }
      
      return { previousNotes };
    },
    onSuccess: () => {
      // No toast notification for successful deletion
      // This avoids cluttering the UI, especially on small screens
      console.log("[DELETE SUCCESS] Note deleted successfully");
    },
    onError: (error, variables, context) => {
      // If the mutation fails, roll back to the previous notes
      if (context?.previousNotes && projectId) {
        queryClient.setQueryData<Note[]>([`/api/projects/${projectId}/notes`], context.previousNotes);
      }
      
      toast({
        title: "Failed to delete note",
        description: error.message,
        variant: "destructive",
      });
    },
    onSettled: () => {
      // Always refetch to make sure we're in sync with the server
      if (projectId) {
        queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/notes`] });
      }
    }
  });

  const updateNoteParent = useMutation({
    mutationFn: async ({ noteId, parentId, order }: { noteId: number; parentId: number | null; order?: number }) => {
      await apiRequest("PUT", `/api/notes/${noteId}/parent`, { parentId, order });
    },
    onMutate: async ({ noteId, parentId, order }) => {
      // Skip optimistic update if we don't have the notes data yet
      if (!notes || !projectId) return;
      
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: [`/api/projects/${projectId}/notes`] });
      
      // Snapshot the previous value
      const previousNotes = queryClient.getQueryData<Note[]>([`/api/projects/${projectId}/notes`]);
      
      // Optimistically update the UI
      if (previousNotes) {
        const sourceNote = findNoteById(previousNotes, noteId);
        
        if (sourceNote) {
          // Create an updated version of the source note
          const updatedSourceNote: Note = {
            ...sourceNote,
            parentId,
            order: order !== undefined ? order : 
                   (typeof sourceNote.order === 'string' ? parseFloat(sourceNote.order) : sourceNote.order),
            updatedAt: new Date()
          };
          
          // Update the source note in the list
          const updatedNotes = updateNoteInList(previousNotes, updatedSourceNote);
          
          queryClient.setQueryData<Note[]>([`/api/projects/${projectId}/notes`], updatedNotes);
        }
      }
      
      return { previousNotes };
    },
    onError: (error, variables, context) => {
      // If the mutation fails, roll back to the previous notes
      if (context?.previousNotes && projectId) {
        queryClient.setQueryData<Note[]>([`/api/projects/${projectId}/notes`], context.previousNotes);
      }
      
      toast({
        title: "Failed to move note",
        description: error.message,
        variant: "destructive",
      });
    },
    onSettled: () => {
      // Always refetch to make sure we're in sync with the server
      if (projectId) {
        queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/notes`] });
      }
    }
  });

  const updateNoteOrder = useMutation({
    mutationFn: async ({ noteId, order }: { noteId: number; order: number }) => {
      await apiRequest("PUT", `/api/notes/${noteId}/order`, { order });
    },
    onMutate: async ({ noteId, order }) => {
      // Skip optimistic update if we don't have the notes data yet
      if (!notes || !projectId) return;
      
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: [`/api/projects/${projectId}/notes`] });
      
      // Snapshot the previous value
      const previousNotes = queryClient.getQueryData<Note[]>([`/api/projects/${projectId}/notes`]);
      
      // Optimistically update the UI
      if (previousNotes) {
        const sourceNote = findNoteById(previousNotes, noteId);
        
        if (sourceNote) {
          // Create an updated version of the source note
          const updatedSourceNote: Note = {
            ...sourceNote,
            order: order,
            updatedAt: new Date()
          };
          
          // Update the source note in the list
          const updatedNotes = updateNoteInList(previousNotes, updatedSourceNote);
          
          queryClient.setQueryData<Note[]>([`/api/projects/${projectId}/notes`], updatedNotes);
        }
      }
      
      return { previousNotes };
    },
    onError: (error, variables, context) => {
      // If the mutation fails, roll back to the previous notes
      if (context?.previousNotes && projectId) {
        queryClient.setQueryData<Note[]>([`/api/projects/${projectId}/notes`], context.previousNotes);
      }
      
      toast({
        title: "Failed to reorder note",
        description: error.message,
        variant: "destructive",
      });
    },
    onSettled: () => {
      // Always refetch to make sure we're in sync with the server
      if (projectId) {
        queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/notes`] });
      }
    }
  });

  const uploadImage = useMutation({
    mutationFn: async (file: File) => {
      try {
        // Get Supabase authentication headers
        const supabase = await getSupabaseClient();
        const { data } = await supabase.auth.getSession();
        
        // Create FormData and append the file
        const formData = new FormData();
        formData.append("image", file);
        
        // Set up headers with authentication
        const headers: Record<string, string> = {};
        
        // Add Supabase auth headers
        if (data.session) {
          headers['x-supabase-user-id'] = data.session.user.id;
          if (data.session.user.email) {
            headers['x-supabase-user-email'] = data.session.user.email;
          }
        }
        
        console.log('Uploading image via server API...');
        
        // Make the request with proper headers
        const res = await fetch("/api/upload", {
          method: "POST",
          headers,
          body: formData,
          credentials: "include",
        });
        
        if (!res.ok) {
          const errorText = await res.text();
          console.error('Upload failed:', errorText);
          throw new Error(errorText || "Failed to upload image");
        }
        
        const result = await res.json();
        console.log('Image uploaded successfully, storage type:', result.storedIn || 'unknown');
        return result;
      } catch (error) {
        console.error('Failed to upload image:', error);
        throw new Error(error instanceof Error ? error.message : "Failed to upload image");
      }
    },
    onSuccess: (data) => {
      console.log('Image upload success, URL:', data.imageUrl);
      toast({
        title: "Image uploaded successfully",
        description: data.storedIn === 'supabase' 
          ? "Image stored in cloud storage for persistence" 
          : "Image stored temporarily",
        duration: 3000,
      });
    },
    onError: (error) => {
      console.error('Upload error:', error);
      toast({
        title: "Failed to upload image",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return {
    notes,
    isLoading,
    error,
    createNote,
    updateNote,
    deleteNote,
    updateNoteParent,
    updateNoteOrder,
    uploadImage,
    startEditing,
    stopEditing,
    editingNoteId,
    isEditing
  };
}