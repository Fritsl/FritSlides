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
      
      // Create a controller to handle timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 120000); // 2 minute timeout
      
      // Show initial progress toast
      const progressToast = toast({
        title: "Duplicating project",
        description: "This may take a minute for large projects. Please wait while we duplicate all notes...",
        duration: 60000, // Long duration
      });
      
      // Create progress update function
      const updateProgress = (progress: string) => {
        toast({
          title: "Duplicating project",
          description: progress,
          duration: 60000, // Long duration
        });
      };
      
      try {
        // Update progress after 5 seconds to reassure user
        setTimeout(() => {
          updateProgress("Still working... For large projects this can take up to a minute.");
        }, 5000);
        
        // Update progress after 20 seconds if it's taking longer
        setTimeout(() => {
          updateProgress("Still duplicating notes... Please be patient, this is a one-time operation.");
        }, 20000);
        
        // Make the API request with timeout
        const newProjectRes = await apiRequest("POST", "/api/projects", { 
          name: newName,
          duplicateFromId: id 
        }, {
          signal: controller.signal
        });
        
        // Clear the timeout since the request completed
        clearTimeout(timeoutId);
        
        // Handle the response
        const newProject = await newProjectRes.json();
        console.log("[PROJECT] Server returned duplicated project:", newProject);
        
        // Show a "finishing up" toast
        toast({
          title: "Almost done!",
          description: "Finalizing duplication...",
        });
        
        // Update the last opened project to ensure we navigate to the new project
        await apiRequest("POST", "/api/user/lastProject", { projectId: newProject.id });
        
        return newProject;
      } catch (error: any) {
        // Clear the timeout if there was an error
        clearTimeout(timeoutId);
        
        if (error.name === 'AbortError') {
          console.error("[PROJECT] Duplication timed out after 2 minutes");
          throw new Error("Project duplication timed out. The server is taking too long to respond.");
        }
        
        // Re-throw other errors
        throw error;
      }
    },
    onSuccess: (newProject) => {
      // Invalidate all related queries to ensure UI is updated
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${newProject.id}/notes`] });
      queryClient.invalidateQueries({ queryKey: ["/api/user/lastProject"] });
      
      // Show final success toast
      toast({
        title: "Project duplicated successfully",
        description: `Created a new project "${newProject.name}" with ${newProject.notesCopied || 'all'} notes copied.`,
        variant: "default",
      });
      
      console.log("[PROJECT] Project duplication complete", newProject);
      
      // Return the ID for any further operations
      return newProject.id;
    },
    onError: (error: any) => {
      toast({
        title: "Failed to duplicate project",
        description: error.message || "An unexpected error occurred",
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
