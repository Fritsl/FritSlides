import { useQuery, useMutation } from "@tanstack/react-query";
import { Note, InsertNote, UpdateNote } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";

export function useNotes(projectId: number | null) {
  const { toast } = useToast();
  const [lastCreatedNoteId, setLastCreatedNoteId] = useState<number | null>(null);
  
  const {
    data: notes,
    isLoading,
    error,
  } = useQuery<Note[]>({
    queryKey: projectId ? [`/api/projects/${projectId}/notes`] : [null],
    enabled: !!projectId,
  });

  const createNote = useMutation({
    mutationFn: async (note: Omit<InsertNote, "projectId">) => {
      if (!projectId) throw new Error("Project ID is required");
      const res = await apiRequest("POST", `/api/projects/${projectId}/notes`, note);
      return res.json();
    },
    onSuccess: (createdNote) => {
      // Store the ID of the newly created note
      setLastCreatedNoteId(createdNote.id);
      
      if (projectId) {
        queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/notes`] });
      }
      toast({
        title: "Note created",
        description: "Your new note has been created successfully.",
      });
    },
    onError: (error) => {
      toast({
        title: "Failed to create note",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateNote = useMutation({
    mutationFn: async ({ id, ...note }: UpdateNote & { id: number }) => {
      const res = await apiRequest("PUT", `/api/notes/${id}`, note);
      return res.json();
    },
    onSuccess: () => {
      if (projectId) {
        queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/notes`] });
      }
      toast({
        title: "Note updated",
        description: "Your note has been updated successfully.",
      });
    },
    onError: (error) => {
      toast({
        title: "Failed to update note",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteNote = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/notes/${id}`);
    },
    onSuccess: () => {
      if (projectId) {
        queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/notes`] });
      }
      toast({
        title: "Note deleted",
        description: "Your note has been deleted successfully.",
      });
    },
    onError: (error) => {
      toast({
        title: "Failed to delete note",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateNoteParent = useMutation({
    mutationFn: async ({ noteId, parentId }: { noteId: number; parentId: number | null }) => {
      await apiRequest("PUT", `/api/notes/${noteId}/parent`, { parentId });
    },
    onSuccess: () => {
      if (projectId) {
        queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/notes`] });
      }
    },
    onError: (error) => {
      toast({
        title: "Failed to move note",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateNoteOrder = useMutation({
    mutationFn: async ({ noteId, order }: { noteId: number; order: number }) => {
      await apiRequest("PUT", `/api/notes/${noteId}/order`, { order });
    },
    onSuccess: () => {
      if (projectId) {
        queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/notes`] });
      }
    },
    onError: (error) => {
      toast({
        title: "Failed to reorder note",
        description: error.message,
        variant: "destructive",
      });
    },
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

  const clearLastCreatedNoteId = () => {
    setLastCreatedNoteId(null);
  };

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
    lastCreatedNoteId,
    clearLastCreatedNoteId,
  };
}
