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
      toast({
        title: "Project created",
        description: "Your new project has been created successfully.",
      });
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
    mutationFn: async ({ id, name }: { id: number; name: string }) => {
      const res = await apiRequest("PUT", `/api/projects/${id}`, { name });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      toast({
        title: "Project updated",
        description: "Your project has been updated successfully.",
      });
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
        description: "Your project has been deleted successfully.",
      });
    },
    onError: (error) => {
      toast({
        title: "Failed to delete project",
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
  };
}
