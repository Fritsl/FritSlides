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
      // Skip optimistic update if we don't have the notes data yet
      if (!notes || !projectId) return;
      
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: [`/api/projects/${projectId}/notes`] });
      
      // Snapshot the previous value
      const previousNotes = queryClient.getQueryData<Note[]>([`/api/projects/${projectId}/notes`]);
      
      // Create an optimistic note
      const optimisticNote = createOptimisticNote(newNote, projectId);
      
      // Optimistically update the UI
      if (previousNotes) {
        queryClient.setQueryData<Note[]>(
          [`/api/projects/${projectId}/notes`], 
          [...previousNotes, optimisticNote]
        );
      }
      
      return { previousNotes, optimisticNote };
    },
    onSuccess: (data, variables, context) => {
      // No need to invalidate manually since we'll update the cache with the server response
      if (projectId) {
        // Get the current notes
        const currentNotes = queryClient.getQueryData<Note[]>([`/api/projects/${projectId}/notes`]);
        
        if (currentNotes && context?.optimisticNote) {
          // Replace the optimistic note with the real one
          const updatedNotes = currentNotes.map(note => 
            note.id === context.optimisticNote.id ? data : note
          );
          
          // Update the cache with the real note
          queryClient.setQueryData<Note[]>([`/api/projects/${projectId}/notes`], updatedNotes);
        } else {
          // Fallback to invalidating if something went wrong
          queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/notes`] });
        }
      }
      
      toast({
        title: "Note created",
        description: "Your new note has been created successfully.",
      });
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
      const res = await apiRequest("PUT", `/api/notes/${id}`, note);
      return res.json();
    },
    onMutate: async (updatedNote: Partial<UpdateNote> & { id: number }) => {
      // Skip optimistic update if we don't have the notes data yet
      if (!notes || !projectId) return;
      
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: [`/api/projects/${projectId}/notes`] });
      
      // Snapshot the previous value
      const previousNotes = queryClient.getQueryData<Note[]>([`/api/projects/${projectId}/notes`]);
      
      // Optimistically update the UI
      if (previousNotes) {
        const updatedNotes = updateNoteInList(previousNotes, updatedNote);
        queryClient.setQueryData<Note[]>([`/api/projects/${projectId}/notes`], updatedNotes);
      }
      
      return { previousNotes };
    },
    onSuccess: () => {
      toast({
        title: "Note updated",
        description: "Your note has been updated successfully.",
      });
    },
    onError: (error, variables, context) => {
      // If the mutation fails, roll back to the previous notes
      if (context?.previousNotes && projectId) {
        queryClient.setQueryData<Note[]>([`/api/projects/${projectId}/notes`], context.previousNotes);
      }
      
      toast({
        title: "Failed to update note",
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
      toast({
        title: "Note deleted",
        description: "Your note has been deleted successfully.",
      });
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
