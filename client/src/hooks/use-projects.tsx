import { useQuery, useMutation } from "@tanstack/react-query";
import { Project } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export function useProjects() {
  const { toast } = useToast();
  
  const {
    data: projects,
    isLoading,
    error,
  } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
  });

  const createProject = useMutation({
    mutationFn: async ({ name }: { name: string }) => {
      const res = await apiRequest("POST", "/api/projects", { name });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      // No toast notification for successful creation
      // This avoids cluttering the UI, especially on small screens
      console.log("[PROJECT] Project created successfully");
    },
    onError: (error) => {
      toast({
        title: "Failed to create project",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateProject = useMutation({
    mutationFn: async ({ 
      id, 
      name, 
      startSlogan, 
      endSlogan, 
      author 
    }: { 
      id: number; 
      name: string; 
      startSlogan?: string | null;
      endSlogan?: string | null;
      author?: string | null;
    }) => {
      const res = await apiRequest("PUT", `/api/projects/${id}`, { 
        name, 
        startSlogan, 
        endSlogan, 
        author 
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      // No toast notification for successful update
      // This avoids cluttering the UI, especially on small screens
      console.log("[PROJECT] Project updated successfully");
    },
    onError: (error) => {
      toast({
        title: "Failed to update project",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteProject = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/projects/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      toast({
        title: "Project deleted",
        description: "The project has been successfully deleted.",
      });
      console.log("[PROJECT] Project deleted successfully");
    },
    onError: (error) => {
      toast({
        title: "Failed to delete project",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const duplicateProject = useMutation({
    mutationFn: async ({ id, newName }: { id: number; newName: string }) => {
      // Simplified approach - create a new project with the same settings,
      // without pre-fetching all the projects and notes separately
      const newProjectRes = await apiRequest("POST", "/api/projects", { 
        name: newName,
        // We'll copy these properties server-side
        duplicateFromId: id 
      });
      
      // First wait for the project creation to complete
      const newProject = await newProjectRes.json();
      
      // Update last opened project to ensure we open the new project on success
      await apiRequest("POST", "/api/user/lastProject", { projectId: newProject.id });
      
      // Give the server a moment to create some initial notes before redirecting
      // This delay helps prevent showing an empty project initially
      await new Promise(resolve => setTimeout(resolve, 300));
      
      return newProject;
    },
    onSuccess: (newProject) => {
      // Invalidate both the projects list and notes for the new project
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      
      // Specifically invalidate the notes for the new project to ensure fresh data
      queryClient.invalidateQueries({ 
        queryKey: [`/api/projects/${newProject.id}/notes`]
      });
      
      // Also invalidate the last opened project query to ensure proper navigation
      queryClient.invalidateQueries({ 
        queryKey: ["/api/user/lastProject"]
      });
      
      toast({
        title: "Project duplicated",
        description: "The project and all its notes have been duplicated. Notes will continue to be copied in the background.",
      });
      
      console.log("[PROJECT] Project duplicated successfully", newProject);
      
      // Just return the ID, not the whole project object
      return newProject.id;
    },
    onError: (error) => {
      toast({
        title: "Failed to duplicate project",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return {
    projects,
    isLoading,
    error,
    createProject,
    updateProject,
    deleteProject,
    duplicateProject,
  };
}
