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
      
      return await newProjectRes.json();
    },
    onSuccess: (newProject) => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      toast({
        title: "Project duplicated",
        description: "The project and all its notes have been duplicated.",
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
