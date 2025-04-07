import { useState, useRef, useEffect } from "react";
import { useDrag, useDrop } from "react-dnd";
import { Note } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { FileUpload } from "./file-upload";
import { ConfirmationDialog } from "./confirmation-dialog";
import { useNotes } from "@/hooks/use-notes";
import { getLevelColor } from "@/lib/colors";
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
  moveNote: (noteId: number, targetId: number, position: 'before' | 'after' | 'child' | 'first-child') => void;
  createNote: any;
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
  createNote,
}: NoteItemProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [isNewlyCreated, setIsNewlyCreated] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [deleteChildren, setDeleteChildren] = useState(false);
  const [dragPosition, setDragPosition] = useState<'before' | 'after' | 'child' | 'first-child' | null>(null);
  const noteRef = useRef<HTMLDivElement>(null);
  const contentInputRef = useRef<HTMLTextAreaElement>(null);
  
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
    console.log(`[Note ${note.id}] Input change - field: ${name}, value: ${value.substring(0, 15)}${value.length > 15 ? '...' : ''}`);
    console.log(`[Note ${note.id}] Before input change - isEditing: ${isEditing}, isNewlyCreated: ${isNewlyCreated}`);
    setFormData(prev => ({ ...prev, [name]: value }));
    console.log(`[Note ${note.id}] After input change - isEditing: ${isEditing}, isNewlyCreated: ${isNewlyCreated}`);
  };
  
  // Handle form submission
  const handleSave = () => {
    console.log(`[Note ${note.id}] Save button clicked - current state - isEditing: ${isEditing}, isNewlyCreated: ${isNewlyCreated}`);
    
    // Create an update object that matches the UpdateNote type
    const updateData = {
      id: note.id,
      content: formData.content,
      url: formData.url || null,
      linkText: formData.linkText || null,
      youtubeLink: formData.youtubeLink || null,
      time: formData.time || null,
      images: formData.images,
      // Include other required fields that we're not changing
      projectId: note.projectId,
      parentId: note.parentId,
      order: note.order,
    };
    
    // Set a flag to remember whether this note was in "newly created" mode
    // This way even if the component rerenders, we'll have the information
    const wasNewlyCreated = isNewlyCreated;
    
    console.log(`[Note ${note.id}] About to update with data:`, updateData);
    console.log(`[Note ${note.id}] wasNewlyCreated: ${wasNewlyCreated}`);
    
    // @ts-ignore - Types are incorrect for useMutation
    updateNote.mutate(updateData, {
      onSuccess: (updatedNote) => {
        console.log(`[Note ${note.id}] Update succeeded`);
        
        // Track whether we'll exit edit mode or not
        let shouldExitEditMode = false;
        
        // Persist edit mode for newly created notes with a different logic
        if (wasNewlyCreated) {
          console.log(`[Note ${note.id}] This was a newly created note, checking if we should exit edit mode`);
          
          // We'll stay in edit mode if content is empty or basic
          const contentIsBasic = formData.content.trim() === '';
          
          // We'll exit edit mode if user has filled in content AND additional fields
          const hasFilledAdditionalFields = 
            formData.url !== '' || 
            formData.linkText !== '' || 
            formData.youtubeLink !== '' || 
            formData.time !== '' || 
            formData.images.length > 0;
          
          if (contentIsBasic) {
            console.log(`[Note ${note.id}] Content is empty/basic, staying in edit mode`);
            // Stay in edit mode, but mark note as no longer "newly created"
            // This ensures subsequent interactions work properly
            setIsNewlyCreated(false);
          } else if (hasFilledAdditionalFields) {
            console.log(`[Note ${note.id}] Content and additional fields filled, exiting edit mode`);
            // Exit edit mode if the note is fully formed
            shouldExitEditMode = true;
            setIsNewlyCreated(false);
          } else {
            console.log(`[Note ${note.id}] Only basic content, staying in edit mode for more edits`);
            // Keep edit mode for more edits, but note is no longer "newly created"
            setIsNewlyCreated(false);
          }
        } else {
          console.log(`[Note ${note.id}] This was a regular edit, exiting edit mode`);
          // For regular notes, exit edit mode after save
          shouldExitEditMode = true;
        }
        
        // Apply edit mode change at the end 
        if (shouldExitEditMode) {
          console.log(`[Note ${note.id}] Setting isEditing to false`);
          setIsEditing(false);
        } else {
          console.log(`[Note ${note.id}] Keeping edit mode active (isEditing: true)`);
        }
      },
      onError: (error) => {
        console.log(`[Note ${note.id}] Update failed:`, error);
      }
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
    
    // Reset newly created state when canceling
    if (isNewlyCreated) {
      setIsNewlyCreated(false);
    }
    
    setIsEditing(false);
  };
  
  // Handle delete confirmation
  const handleDelete = () => {
    // When the deleteChildren toggle is checked, pass true to the API
    deleteNote.mutate({ id: note.id, deleteChildren }, {
      onSuccess: () => {
        setIsDeleteDialogOpen(false);
        setDeleteChildren(false); // Reset for next time
      }
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
      images: prev.images.filter((img: string) => img !== url)
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
      
      // DEBUG: Log these values
      console.log(`=== HOVER DEBUG (note ${note.id}) ===`);
      console.log(`Rect: top=${hoverBoundingRect.top}, bottom=${hoverBoundingRect.bottom}, left=${hoverBoundingRect.left}, right=${hoverBoundingRect.right}`);
      console.log(`Middle Y: ${hoverMiddleY}, Cursor Y: ${hoverClientY}`);
      console.log(`Middle X: ${hoverMiddleX}, Cursor X: ${hoverClientX}`);
      
      // Determine drop position with improved algorithm
      // Define the horizontal zones (0-30% left, 30-70% middle, 70-100% right)
      const leftThreshold = hoverBoundingRect.width * 0.3;
      const rightThreshold = hoverBoundingRect.width * 0.7;
      
      // Define the vertical zones (0-40% top, 40-60% middle, 60-100% bottom)
      const topThreshold = hoverBoundingRect.height * 0.4;
      const bottomThreshold = hoverBoundingRect.height * 0.6;
      
      // Determine the zone
      const isLeftZone = hoverClientX < leftThreshold;
      const isRightZone = hoverClientX > rightThreshold;
      const isMiddleZone = !isLeftZone && !isRightZone;
      
      const isTopZone = hoverClientY < topThreshold;
      const isBottomZone = hoverClientY > bottomThreshold;
      const isMiddleVerticalZone = !isTopZone && !isBottomZone;
      
      console.log(`Drop zone: ${isLeftZone ? 'Left' : isRightZone ? 'Right' : 'Middle'}-${isTopZone ? 'Top' : isBottomZone ? 'Bottom' : 'Middle'}`);
      console.log(`Left threshold: ${leftThreshold.toFixed(2)}, Right threshold: ${rightThreshold.toFixed(2)}`);
      console.log(`Top threshold: ${topThreshold.toFixed(2)}, Bottom threshold: ${bottomThreshold.toFixed(2)}`);
      
      let newPosition: 'before' | 'after' | 'child' | 'first-child' | null = null;
      
      // Improved position determination logic
      if (isTopZone) {
        // Top of the note
        if (isLeftZone || isMiddleZone) {
          // Use before for the entire top except far right
          newPosition = 'before';
        } else {
          // Far right-top corner - first child
          newPosition = 'first-child';
        }
      } else if (isBottomZone) {
        // Bottom of the note
        if (isLeftZone || isMiddleZone) {
          // Use after for the entire bottom except far right
          newPosition = 'after';
        } else {
          // Far right-bottom corner - child
          newPosition = 'child';
        }
      } else {
        // Middle of the note
        if (isLeftZone) {
          // Middle left - before
          newPosition = 'before';
        } else if (isRightZone) {
          // Middle right - child
          newPosition = 'child';
        } else {
          // Middle area - use before for top half, after for bottom half
          newPosition = hoverClientY < hoverMiddleY ? 'before' : 'after';
        }
      }
      
      console.log(`Selected position: ${newPosition}`);
      setDragPosition(newPosition);
    },
    drop: (item: { id: number }) => {
      console.log(`=== DROP DEBUG ===`);
      console.log(`Dropping noteId ${item.id} onto noteId ${note.id} with position ${dragPosition}`);
      
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
      case 'first-child':
        return "before:absolute before:top-0 before:right-0 before:w-1 before:h-1/2 before:bg-green-500";
      case 'child':
        return "after:absolute after:bottom-0 after:right-0 after:w-1 after:h-1/2 after:bg-yellow-500";
      default:
        return "";
    }
  };
  
  // Effect to focus on content field when entering edit mode
  useEffect(() => {
    if (isEditing && contentInputRef.current) {
      contentInputRef.current.focus();
    }
  }, [isEditing]);

  // Effect to check for newly created note flag
  useEffect(() => {
    console.log(`[Note ${note.id}] Effect for newly created note check running.`);
    console.log(`[Note ${note.id}] Current state - isEditing: ${isEditing}, isNewlyCreated: ${isNewlyCreated}`);
    
    const newNoteFlag = localStorage.getItem('newNoteCreated');
    const lastCreatedId = localStorage.getItem('lastCreatedNoteId');
    
    console.log(`[Note ${note.id}] localStorage flags - newNoteCreated: ${newNoteFlag}, lastCreatedNoteId: ${lastCreatedId}`);
    
    // Determine if this is a newly created note
    const isNewNoteByFlag = newNoteFlag === 'true' && note.content === '';
    const isNewNoteById = lastCreatedId && parseInt(lastCreatedId) === note.id;
    
    console.log(`[Note ${note.id}] Detection results - isNewNoteByFlag: ${isNewNoteByFlag}, isNewNoteById: ${isNewNoteById}`);
    
    // If this is a newly created note...
    if ((isNewNoteByFlag || isNewNoteById) && !isEditing) {
      console.log(`[Note ${note.id}] Detected as newly created note, will enter edit mode`);
      
      // Mark this note as newly created
      setIsNewlyCreated(true);
      
      // Clear the flags that apply to this note
      if (isNewNoteByFlag) {
        console.log(`[Note ${note.id}] Clearing newNoteCreated flag`);
        localStorage.removeItem('newNoteCreated');
      }
      
      if (isNewNoteById) {
        console.log(`[Note ${note.id}] Clearing lastCreatedNoteId flag`);
        localStorage.removeItem('lastCreatedNoteId');
      }
      
      // Small delay to ensure this runs after the component is fully mounted
      setTimeout(() => {
        console.log(`[Note ${note.id}] Setting isEditing to true after delay`);
        setIsEditing(true);
      }, 50);
    } else {
      console.log(`[Note ${note.id}] Not entering edit mode: ${!isNewNoteByFlag && !isNewNoteById ? 'Not identified as new note' : 'Already in edit mode'}`);
    }
  }, [note.id, note.content, isEditing, isNewlyCreated]);

  // Track editing state with a ref to detect unexpected changes
  const isEditingRef = useRef(isEditing);
  
  // Effect to detect change in note data from server and preserve edit mode
  useEffect(() => {
    console.log(`[Note ${note.id}] Note data changed from server`);
    console.log(`[Note ${note.id}] Current state before data change effect - isEditing: ${isEditing}, isNewlyCreated: ${isNewlyCreated}`);
    console.log(`[Note ${note.id}] Previous edit state from ref: ${isEditingRef.current}`);
    
    // Only make changes if necessary
    if (isEditing) {
      // We are in edit mode, note that we want to stay here
      console.log(`[Note ${note.id}] Currently in edit mode - will preserve this state`);
      
      // Update form data with new values from the server that might have changed
      // but preserve user changes that haven't been saved yet
      setFormData(prev => {
        // Only update non-edited fields, or fields relevant to structure
        // We don't want to overwrite what the user is currently editing!
        return {
          ...prev,
          // We'll preserve most fields as they are (user's current edits)
          // But update any structural fields that might have changed:
          projectId: note.projectId,
          parentId: note.parentId,
          order: note.order,
        };
      });
    } else if (isEditingRef.current) {
      // If we were editing but now aren't, this means state was lost in a re-render
      console.log(`[Note ${note.id}] Edit mode was lost during re-render - restoring it`);
      
      // Restore edit mode
      setTimeout(() => {
        setIsEditing(true);
      }, 0);
    }
    
    // Update ref to current value for next render
    isEditingRef.current = isEditing;
    
  }, [note, isEditing, isNewlyCreated]); // Include isEditing and isNewlyCreated in deps list
  
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
            style={{ 
              backgroundColor: isEditing 
                ? getLevelColor(level).light 
                : getLevelColor(level).regular,
              color: "white" 
            }}
            className={`relative rounded-md p-3 shadow-sm border border-transparent ${isEditing ? "border-primary shadow" : "hover:border-neutral-subtle"} group ${getDragIndicatorClass()}`}
          >
            {isEditing ? (
              // Edit mode
              <div>
                <div className="flex items-start">
                  <div ref={drag} className="cursor-grab pr-2 pt-1 opacity-30 hover:opacity-100">
                    <GripVertical className="h-4 w-4 text-white" />
                  </div>
                  <div className="flex-1">
                    <div className="mb-3">
                      <Textarea
                        ref={contentInputRef}
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
                        <label className="font-medium text-white w-20 mb-1 sm:mb-0">URL</label>
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
                        <label className="font-medium text-white w-20 mb-1 sm:mb-0">Link Text</label>
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
                        <label className="font-medium text-white w-20 mb-1 sm:mb-0">YouTube</label>
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
                        <label className="font-medium text-white w-20 mb-1 sm:mb-0">Time</label>
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
                        <label className="font-medium text-white mb-1">Images</label>
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
                    <GripVertical className="h-4 w-4 text-white opacity-70" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-white">{note.content.split('\n')[0]}</p>
                    {note.content.split('\n').length > 1 && (
                      <p className="text-sm text-white text-opacity-80">{note.content.split('\n').slice(1).join('\n')}</p>
                    )}
                  </div>
                  <div className="flex space-x-1 ml-2">
                    {hasUrl && (
                      <div className="text-blue-200" title="Contains links">
                        <Link className="h-4 w-4" />
                      </div>
                    )}
                    {hasYouTube && (
                      <div className="text-red-200" title="Contains YouTube links">
                        <Youtube className="h-4 w-4" />
                      </div>
                    )}
                    {hasImages && (
                      <div className="text-green-200" title="Contains images">
                        <Image className="h-4 w-4" />
                      </div>
                    )}
                    {note.time && (
                      <div className="text-yellow-200" title={`Time: ${note.time}`}>
                        <Clock className="h-4 w-4" />
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex mt-2 space-x-1 opacity-0 group-hover:opacity-100">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="p-1 h-auto text-blue-200 hover:bg-blue-900/40 hover:text-blue-100"
                    onClick={() => setIsEditing(true)}
                    title="Edit note"
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="p-1 h-auto text-green-200 hover:bg-green-900/40 hover:text-green-100"
                    onClick={() => {
                      // Set both flags: newNoteCreated for backward compatibility,
                      // and we'll rely on the lastCreatedNoteId that will be set
                      // in the onSuccess callback in useNotes hook
                      localStorage.setItem('newNoteCreated', 'true');
                      
                      (createNote.mutate as any)({
                        projectId: note.projectId,
                        parentId: note.parentId,
                        content: "",
                        order: (Number(note.order) + 1).toString(),
                        url: "",
                        linkText: "",
                        youtubeLink: "",
                        time: "",
                        images: []
                      });
                    }}
                    title="Add note below"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="p-1 h-auto text-yellow-200 hover:bg-yellow-900/40 hover:text-yellow-100"
                    onClick={() => {
                      // Set both flags: newNoteCreated for backward compatibility,
                      // and we'll rely on the lastCreatedNoteId that will be set
                      // in the onSuccess callback in useNotes hook
                      localStorage.setItem('newNoteCreated', 'true');
                      
                      (createNote.mutate as any)({
                        projectId: note.projectId,
                        parentId: note.id,
                        content: "",
                        order: "0",
                        url: "",
                        linkText: "",
                        youtubeLink: "",
                        time: "",
                        images: []
                      });
                      
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
                    className="p-1 h-auto text-red-200 hover:bg-red-900/40 hover:text-red-100"
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
        description={
          hasChildren
          ? "Do you want to delete this note? By default, any child notes will be promoted to the same level."
          : "Are you sure you want to delete this note? This action cannot be undone."
        }
        confirmText="Delete"
        onConfirm={handleDelete}
        isPending={deleteNote.isPending}
        confirmVariant="destructive"
        extraContent={hasChildren && (
          <div className="flex items-center space-x-2">
            <Switch
              id="delete-children"
              checked={deleteChildren}
              onCheckedChange={setDeleteChildren}
            />
            <Label htmlFor="delete-children">Also delete all children</Label>
          </div>
        )}
      />
    </div>
  );
}
