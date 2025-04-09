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
      console.log("[PROJECT] Starting project duplication of ID", id, "with name", newName);
      
      // Show a toast to indicate progress
      toast({
        title: "Duplicating project",
        description: "Please wait while we duplicate the project and all its notes...",
      });
      
      // Now we wait for the server to complete the duplication synchronously
      const newProjectRes = await apiRequest("POST", "/api/projects", { 
        name: newName,
        duplicateFromId: id 
      });
      
      // This will only complete after the server has finished copying all notes
      const newProject = await newProjectRes.json();
      console.log("[PROJECT] Server returned duplicated project:", newProject);
      
      // Update the last opened project to ensure we navigate to the new project
      await apiRequest("POST", "/api/user/lastProject", { projectId: newProject.id });
      
      return newProject;
    },
    onSuccess: (newProject) => {
      // Invalidate all related queries to ensure UI is updated
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${newProject.id}/notes`] });
      queryClient.invalidateQueries({ queryKey: ["/api/user/lastProject"] });
      
      // Show success toast
      toast({
        title: "Project duplicated successfully",
        description: `Created a new project "${newProject.name}" with ${newProject.notesCopied || 'all'} notes copied.`,
        variant: "default",
      });
      
      console.log("[PROJECT] Project duplication complete", newProject);
      
      // Return the ID for any further operations
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
