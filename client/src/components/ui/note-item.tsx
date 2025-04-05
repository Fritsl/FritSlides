import { useState, useRef } from "react";
import { useDrag, useDrop } from "react-dnd";
import { Note } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { FileUpload } from "./file-upload";
import { ConfirmationDialog } from "./confirmation-dialog";
import { useNotes } from "@/hooks/use-notes";
import {
  Link,
  Edit,
  Trash2,
  ChevronDown,
  ChevronRight,
  Plus,
  GripVertical,
  Clock,
  Youtube,
  Image,
  Save,
  X,
  Loader2,
} from "lucide-react";

interface NoteItemProps {
  note: Note;
  level: number;
  projectId: number;
  hasChildren: boolean;
  isExpanded: boolean;
  toggleExpand: () => void;
  onDragStart: () => void;
  onDragEnd: () => void;
  canDrop: (noteId: number) => boolean;
  moveNote: (noteId: number, targetId: number, position: 'before' | 'after' | 'child') => void;
}

// Item types for drag and drop
const ItemTypes = {
  NOTE: "note",
};

export default function NoteItem({
  note,
  level,
  projectId,
  hasChildren,
  isExpanded,
  toggleExpand,
  onDragStart,
  onDragEnd,
  canDrop,
  moveNote,
}: NoteItemProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [dragPosition, setDragPosition] = useState<'before' | 'after' | 'child' | null>(null);
  const noteRef = useRef<HTMLDivElement>(null);
  
  const { updateNote, deleteNote, uploadImage } = useNotes(projectId);
  
  // Form state
  const [formData, setFormData] = useState({
    content: note.content,
    url: note.url || "",
    linkText: note.linkText || "",
    youtubeLink: note.youtubeLink || "",
    time: note.time || "",
    images: note.images || [],
  });
  
  // Handle form input changes
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };
  
  // Handle form submission
  const handleSave = () => {
    updateNote.mutate({
      id: note.id,
      content: formData.content,
      url: formData.url || null,
      linkText: formData.linkText || null,
      youtubeLink: formData.youtubeLink || null,
      time: formData.time || null,
      images: formData.images,
    }, {
      onSuccess: () => setIsEditing(false)
    });
  };
  
  // Handle cancel editing
  const handleCancel = () => {
    setFormData({
      content: note.content,
      url: note.url || "",
      linkText: note.linkText || "",
      youtubeLink: note.youtubeLink || "",
      time: note.time || "",
      images: note.images || [],
    });
    setIsEditing(false);
  };
  
  // Handle delete confirmation
  const handleDelete = () => {
    deleteNote.mutate(note.id, {
      onSuccess: () => setIsDeleteDialogOpen(false)
    });
  };
  
  // Handle image upload
  const handleImageUpload = async (file: File) => {
    const result = await uploadImage.mutateAsync(file);
    // Update the image list in the form data
    setFormData(prev => ({
      ...prev,
      images: [...prev.images, result.imageUrl]
    }));
    return result;
  };
  
  // Handle image removal
  const handleImageRemove = (url: string) => {
    setFormData(prev => ({
      ...prev,
      images: prev.images.filter(img => img !== url)
    }));
  };
  
  // Set up drag source
  const [{ isDragging }, drag, dragPreview] = useDrag({
    type: ItemTypes.NOTE,
    item: () => {
      onDragStart();
      return { id: note.id, text: note.content };
    },
    end: () => onDragEnd(),
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  });
  
  // Set up drop target
  const [{ isOver }, drop] = useDrop({
    accept: ItemTypes.NOTE,
    hover: (item: { id: number }, monitor) => {
      if (!noteRef.current || item.id === note.id) return;
      
      // Check if we can drop this note
      if (!canDrop(item.id)) return;
      
      // Determine vertical position
      const hoverBoundingRect = noteRef.current.getBoundingClientRect();
      const hoverMiddleY = (hoverBoundingRect.bottom - hoverBoundingRect.top) / 2;
      const clientOffset = monitor.getClientOffset();
      const hoverClientY = clientOffset!.y - hoverBoundingRect.top;
      
      // Calculate horizontal position (for child)
      const hoverMiddleX = (hoverBoundingRect.right - hoverBoundingRect.left) / 2;
      const hoverClientX = clientOffset!.x - hoverBoundingRect.left;
      
      // Determine drop position
      const isLeftSide = hoverClientX < hoverMiddleX / 2; // Only child if significantly to the right
      
      if (isLeftSide && hoverClientY < hoverMiddleY / 2) {
        setDragPosition('before');
      } else if (isLeftSide && hoverClientY > hoverMiddleY * 1.5) {
        setDragPosition('after');
      } else {
        setDragPosition('child');
      }
    },
    drop: (item: { id: number }) => {
      if (dragPosition && item.id !== note.id) {
        moveNote(item.id, note.id, dragPosition);
      }
      setDragPosition(null);
    },
    collect: (monitor) => ({
      isOver: monitor.isOver(),
    }),
  });
  
  // Combine drag and drop refs
  drag(drop(noteRef));
  
  // Determine classes for drag preview
  const getDragIndicatorClass = () => {
    if (!isOver || !dragPosition) return "";
    
    switch (dragPosition) {
      case 'before':
        return "before:absolute before:left-0 before:right-0 before:top-0 before:h-1 before:bg-primary";
      case 'after':
        return "after:absolute after:left-0 after:right-0 after:bottom-0 after:h-1 after:bg-primary";
      case 'child':
        return "bg-primary/10";
      default:
        return "";
    }
  };
  
  // Check if note has additional content
  const hasUrl = !!note.url;
  const hasYouTube = !!note.youtubeLink;
  const hasImages = note.images && note.images.length > 0;
  
  return (
    <div
      ref={dragPreview}
      className={`note-item transition-opacity ${isDragging ? "opacity-30" : ""}`}
      data-note-id={note.id}
    >
      <div className="flex items-start group mb-1">
        <button
          className={`p-1 text-neutral-muted hover:text-neutral-text ${!hasChildren && 'opacity-0'}`}
          onClick={toggleExpand}
        >
          {isExpanded ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
        </button>
        <div className="flex-1 ml-1">
          <div
            ref={noteRef}
            className={`relative rounded-md p-3 bg-white shadow-sm border border-transparent ${isEditing ? "border-primary shadow" : "hover:border-neutral-subtle"} group ${getDragIndicatorClass()}`}
          >
            {isEditing ? (
              // Edit mode
              <div>
                <div className="flex items-start">
                  <div ref={drag} className="cursor-grab pr-2 pt-1 opacity-30 hover:opacity-100">
                    <GripVertical className="h-4 w-4 text-neutral-muted" />
                  </div>
                  <div className="flex-1">
                    <div className="mb-3">
                      <Textarea
                        name="content"
                        value={formData.content}
                        onChange={handleInputChange}
                        rows={2}
                        placeholder="Note content..."
                        className="w-full p-2 border-neutral-subtle focus:border-primary"
                      />
                    </div>
                    
                    <div className="space-y-2 text-sm">
                      <div className="flex flex-col sm:flex-row sm:items-center">
                        <label className="font-medium text-neutral-text w-20 mb-1 sm:mb-0">URL</label>
                        <Input
                          name="url"
                          type="text"
                          placeholder="https://..."
                          value={formData.url}
                          onChange={handleInputChange}
                          className="flex-1"
                        />
                      </div>
                      
                      <div className="flex flex-col sm:flex-row sm:items-center">
                        <label className="font-medium text-neutral-text w-20 mb-1 sm:mb-0">Link Text</label>
                        <Input
                          name="linkText"
                          type="text"
                          placeholder="Link description..."
                          value={formData.linkText}
                          onChange={handleInputChange}
                          className="flex-1"
                        />
                      </div>
                      
                      <div className="flex flex-col sm:flex-row sm:items-center">
                        <label className="font-medium text-neutral-text w-20 mb-1 sm:mb-0">YouTube</label>
                        <Input
                          name="youtubeLink"
                          type="text"
                          placeholder="YouTube URL..."
                          value={formData.youtubeLink}
                          onChange={handleInputChange}
                          className="flex-1"
                        />
                      </div>
                      
                      <div className="flex flex-col sm:flex-row sm:items-center">
                        <label className="font-medium text-neutral-text w-20 mb-1 sm:mb-0">Time</label>
                        <Input
                          name="time"
                          type="text"
                          placeholder="HH:MM"
                          value={formData.time}
                          onChange={handleInputChange}
                          className="w-24"
                        />
                      </div>
                      
                      <div className="flex flex-col">
                        <label className="font-medium text-neutral-text mb-1">Images</label>
                        <FileUpload
                          onUpload={handleImageUpload}
                          onRemove={handleImageRemove}
                          existingImages={formData.images}
                        />
                      </div>
                    </div>
                  </div>
                </div>
                <div className="flex justify-end mt-3 space-x-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleCancel}
                    disabled={updateNote.isPending}
                  >
                    <X className="h-4 w-4 mr-1" />
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleSave}
                    disabled={updateNote.isPending}
                  >
                    {updateNote.isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="h-4 w-4 mr-1" />
                        Save
                      </>
                    )}
                  </Button>
                </div>
              </div>
            ) : (
              // Normal mode
              <div>
                <div className="flex items-start">
                  <div ref={drag} className="cursor-grab pr-2 pt-1 opacity-0 group-hover:opacity-100">
                    <GripVertical className="h-4 w-4 text-neutral-muted" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium">{note.content.split('\n')[0]}</p>
                    {note.content.split('\n').length > 1 && (
                      <p className="text-sm text-neutral-text">{note.content.split('\n').slice(1).join('\n')}</p>
                    )}
                  </div>
                  <div className="flex space-x-1 ml-2">
                    {hasUrl && (
                      <div className="text-primary" title="Contains links">
                        <Link className="h-4 w-4" />
                      </div>
                    )}
                    {hasYouTube && (
                      <div className="text-accent" title="Contains YouTube links">
                        <Youtube className="h-4 w-4" />
                      </div>
                    )}
                    {hasImages && (
                      <div className="text-secondary" title="Contains images">
                        <Image className="h-4 w-4" />
                      </div>
                    )}
                    {note.time && (
                      <div className="text-neutral-muted" title={`Time: ${note.time}`}>
                        <Clock className="h-4 w-4" />
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex mt-2 space-x-1 opacity-0 group-hover:opacity-100">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="p-1 h-auto"
                    onClick={() => setIsEditing(true)}
                    title="Edit note"
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="p-1 h-auto"
                    onClick={() => {
                      // Create a new note below this one
                      const newNote = {
                        projectId,
                        parentId: note.parentId,
                        content: "",
                        order: note.order + 1,
                      };
                      useNotes(projectId).createNote.mutate(newNote);
                    }}
                    title="Add note below"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="p-1 h-auto"
                    onClick={() => {
                      // Create a child note
                      const newNote = {
                        projectId,
                        parentId: note.id,
                        content: "",
                        order: 0,
                      };
                      useNotes(projectId).createNote.mutate(newNote);
                      // Ensure the parent is expanded
                      if (!isExpanded) {
                        toggleExpand();
                      }
                    }}
                    title="Add child note"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="p-1 h-auto text-neutral-text hover:bg-red-100 hover:text-red-500"
                    onClick={() => setIsDeleteDialogOpen(true)}
                    title="Delete note"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      
      <ConfirmationDialog
        isOpen={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
        title="Delete Note"
        description="Are you sure you want to delete this note and all its children? This action cannot be undone."
        confirmText="Delete"
        onConfirm={handleDelete}
        isPending={deleteNote.isPending}
        confirmVariant="destructive"
      />
    </div>
  );
}
