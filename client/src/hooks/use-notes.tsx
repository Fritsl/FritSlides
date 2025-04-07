import { useQuery, useMutation } from "@tanstack/react-query";
import { Note, InsertNote, UpdateNote } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

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
const createOptimisticNote = (note: Partial<InsertNote>, projectId: number): Note => {
  // Generate a temporary negative ID to avoid conflicts with real IDs
  const tempId = -Math.floor(Math.random() * 1000000);
  const now = new Date();
  
  // Create an optimistic note with explicit type casting to fix type errors
  return {
    id: tempId,
    projectId: projectId,
    parentId: note.parentId !== undefined ? note.parentId : null,
    content: note.content !== undefined ? note.content : "",
    url: note.url !== undefined ? note.url : null,
    linkText: note.linkText !== undefined ? note.linkText : null,
    youtubeLink: note.youtubeLink !== undefined ? note.youtubeLink : null,
    time: note.time !== undefined ? note.time : null,
    images: Array.isArray(note.images) ? note.images : [],
    order: (typeof note.order === 'number' || typeof note.order === 'string') ? String(note.order) : "0",
    createdAt: now,
    updatedAt: now
  };
};

export function useNotes(projectId: number | null) {
  const { toast } = useToast();
  
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
      const res = await apiRequest("POST", `/api/projects/${targetProjectId}/notes`, note);
      return res.json();
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
      
      // Create an optimistic note
      const optimisticNote = createOptimisticNote(newNote, projectId);
      console.log(`[CREATE MUTATE] Created optimistic note with temp ID: ${optimisticNote.id}`);
      
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
      
      // No need to invalidate manually since we'll update the cache with the server response
      if (projectId) {
        // Get the current notes
        const currentNotes = queryClient.getQueryData<Note[]>([`/api/projects/${projectId}/notes`]);
        
        if (currentNotes && context?.optimisticNote) {
          console.log(`[CREATE SUCCESS] Replacing optimistic note ${context.optimisticNote.id} with real note ${data.id}`);
          
          // Replace the optimistic note with the real one
          const updatedNotes = currentNotes.map(note => {
            if (note.id === context.optimisticNote.id) {
              // IMPORTANT CHANGE: Now that server has confirmed the note creation, 
              // we set the flags to trigger edit mode
              console.log(`[CREATE SUCCESS] Setting up edit mode for new note ${data.id}`);
              localStorage.setItem('newNoteCreated', 'true');
              localStorage.setItem('lastCreatedNoteId', data.id.toString());
              
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
      // No toast notification for note creation to avoid disrupting workflow
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
      // Always refetch to make sure we're in sync with the server
      if (projectId) {
        queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/notes`] });
      }
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
    mutationFn: async ({ noteId, parentId, order }: { noteId: number; parentId: number | null; order?: string }) => {
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
            order: order !== undefined ? String(order) : sourceNote.order,
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
    mutationFn: async ({ noteId, order }: { noteId: number; order: string }) => {
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
            order: String(order),
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
      const formData = new FormData();
      formData.append("image", file);
      
      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      
      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(errorText || "Failed to upload image");
      }
      
      return res.json();
    },
    onError: (error) => {
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
  };
}
