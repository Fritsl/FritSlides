import { useEffect, useState } from "react";
import { Project } from "@shared/schema";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ChevronDown, ChevronUp, Pencil, Trash, Settings } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useProjects } from "@/hooks/use-projects";
import { ConfirmationDialog } from "./confirmation-dialog";

interface ProjectSelectorProps {
  projects: Project[];
  selectedProject: Project | null;
  onSelectProject: (projectId: number) => void;
}

const projectSchema = z.object({
  name: z.string().min(1, "Project name is required").max(50, "Project name is too long"),
  startSlogan: z.string().nullable().optional(),
  endSlogan: z.string().nullable().optional(),
  author: z.string().nullable().optional(),
});

export default function ProjectSelector({
  projects,
  selectedProject,
  onSelectProject,
}: ProjectSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const { updateProject, deleteProject } = useProjects();

  const form = useForm<z.infer<typeof projectSchema>>({
    resolver: zodResolver(projectSchema),
    defaultValues: {
      name: selectedProject?.name || "",
      startSlogan: selectedProject?.startSlogan || null,
      endSlogan: selectedProject?.endSlogan || null,
      author: selectedProject?.author || null,
    },
  });

  // Update form when selected project changes
  useEffect(() => {
    if (selectedProject) {
      form.reset({ 
        name: selectedProject.name,
        startSlogan: selectedProject.startSlogan,
        endSlogan: selectedProject.endSlogan,
        author: selectedProject.author
      });
    }
  }, [selectedProject, form]);

  const onSubmit = (values: z.infer<typeof projectSchema>) => {
    if (selectedProject) {
      updateProject.mutate({
        id: selectedProject.id,
        name: values.name,
        startSlogan: values.startSlogan,
        endSlogan: values.endSlogan,
        author: values.author
      }, {
        onSuccess: () => setIsEditDialogOpen(false),
      });
    }
  };

  const handleDelete = () => {
    if (selectedProject) {
      deleteProject.mutate(selectedProject.id, {
        onSuccess: () => {
          setIsDeleteDialogOpen(false);
          // Select first available project after deletion
          if (projects.length > 1) {
            const nextProject = projects.find(p => p.id !== selectedProject.id);
            if (nextProject) {
              onSelectProject(nextProject.id);
            }
          }
        },
      });
    }
  };

  return (
    <>
      {/* Settings button */}
      {selectedProject && (
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 mr-1"
          onClick={() => setIsEditDialogOpen(true)}
          title="Project Settings"
        >
          <Settings className="h-4 w-4" />
        </Button>
      )}
      
      <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="flex items-center">
            <span className="truncate max-w-[150px]">
              {selectedProject ? selectedProject.name : "Select Project"}
            </span>
            {isOpen ? (
              <ChevronUp className="h-4 w-4 ml-1" />
            ) : (
              <ChevronDown className="h-4 w-4 ml-1" />
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-56">
          {projects.map((project) => (
            <DropdownMenuItem
              key={project.id}
              className={`flex justify-between items-center ${
                selectedProject?.id === project.id ? "bg-neutral-subtle" : ""
              }`}
              onClick={() => {
                onSelectProject(project.id);
                setIsOpen(false);
              }}
            >
              <span className="truncate">{project.name}</span>
              <div className="flex space-x-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-5 w-5"
                  onClick={(e) => {
                    e.stopPropagation();
                    form.reset({
                      name: project.name,
                      startSlogan: project.startSlogan,
                      endSlogan: project.endSlogan,
                      author: project.author
                    });
                    onSelectProject(project.id);
                    setIsEditDialogOpen(true);
                  }}
                >
                  <Pencil className="h-3 w-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-5 w-5 text-destructive"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectProject(project.id);
                    setIsDeleteDialogOpen(true);
                  }}
                >
                  <Trash className="h-3 w-3" />
                </Button>
              </div>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Edit Project Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Project</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Project Name</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="startSlogan"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Start Slogan</FormLabel>
                    <FormControl>
                      <Input {...field} value={field.value || ''} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="endSlogan"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>End Slogan</FormLabel>
                    <FormControl>
                      <Input {...field} value={field.value || ''} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="author"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Author</FormLabel>
                    <FormControl>
                      <Input {...field} value={field.value || ''} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="flex justify-end space-x-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsEditDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={updateProject.isPending}>
                  {updateProject.isPending ? "Saving..." : "Save"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <ConfirmationDialog
        isOpen={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
        title="Delete Project"
        description="Are you sure you want to delete this project? All notes in this project will be permanently deleted. This action cannot be undone."
        confirmText="Delete"
        onConfirm={handleDelete}
        isPending={deleteProject.isPending}
        confirmVariant="destructive"
      />
    </>
  );
}
