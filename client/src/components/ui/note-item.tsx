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
import { MoveNoteDialog } from "./move-note-dialog";
import { FullscreenToggle } from "./fullscreen-toggle";
import { useNotes, useNoteEditing } from "@/hooks/use-notes";
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
  MoveVertical,
  Users,
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
  allNotes?: Note[]; // Make it optional to maintain backward compatibility
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
  allNotes,
}: NoteItemProps) {
  // Use local state for tracking newly created status and dialogs
  const [isNewlyCreated, setIsNewlyCreated] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isMoveDialogOpen, setIsMoveDialogOpen] = useState(false);
  const [deleteChildren, setDeleteChildren] = useState(false);
  const [dragPosition, setDragPosition] = useState<'before' | 'after' | 'child' | 'first-child' | null>(null);
  
  // Mobile edit mode collapsible sections
  const [showAdditionalFields, setShowAdditionalFields] = useState(false);
  
  const noteRef = useRef<HTMLDivElement>(null);
  const contentInputRef = useRef<HTMLTextAreaElement>(null);
  const noteDataRef = useRef<string | null>(null);
  
  // Use the centralized editing state management
  const { 
    updateNote, 
    deleteNote, 
    uploadImage,
    startEditing,
    stopEditing,
    editingNoteId
  } = useNotes(projectId);
  
  // Derive local editing state from global state
  const isEditing = editingNoteId === note.id;
  
  // Form state
  const [formData, setFormData] = useState({
    content: note.content,
    url: note.url || "",
    linkText: note.linkText || "",
    youtubeLink: note.youtubeLink || "",
    time: note.time || "",
    isDiscussion: note.isDiscussion || false,
    images: note.images || [],
  });
  
  // Handle form input changes
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    // Removed excessive logging
    setFormData(prev => ({ ...prev, [name]: value }));
  };
  
  // Handle form submission
  const handleSave = () => {
    // Create an update object that matches the UpdateNote type
    const updateData = {
      id: note.id,
      content: formData.content,
      url: formData.url || null,
      linkText: formData.linkText || null,
      youtubeLink: formData.youtubeLink || null,
      time: formData.time || null,
      isDiscussion: formData.isDiscussion || false,
      images: formData.images,
      // Include other required fields that we're not changing
      projectId: note.projectId,
      parentId: note.parentId,
      order: note.order,
    };
    
    // Set a flag to remember whether this note was in "newly created" mode
    // This way even if the component rerenders, we'll have the information
    const wasNewlyCreated = isNewlyCreated;
    
    // @ts-ignore - Types are incorrect for useMutation
    updateNote.mutate(updateData, {
      onSuccess: (updatedNote) => {
        // No longer newly created
        if (wasNewlyCreated) {
          setIsNewlyCreated(false);
        }
        
        // Set the flag that this is a deliberate exit from edit mode
        // This prevents the note from re-entering edit mode during server sync
        userExitedEditModeRef.current = true;
        stopEditing();
      },
      onError: (error) => {
        console.error(`Note update failed:`, error);
      }
    });
  };
  
  // Handle cancel editing
  const handleCancel = () => {
    // Reset form data to original values
    setFormData({
      content: note.content,
      url: note.url || "",
      linkText: note.linkText || "",
      youtubeLink: note.youtubeLink || "",
      time: note.time || "",
      isDiscussion: note.isDiscussion || false,
      images: note.images || [],
    });
    
    // Reset newly created state when canceling
    if (isNewlyCreated) {
      setIsNewlyCreated(false);
    }
    
    // Mark this as a deliberate exit from edit mode
    // to prevent the effect from restoring edit mode during server sync
    userExitedEditModeRef.current = true;
    
    // Exit edit mode
    stopEditing();
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
  
  // Set up drag source - disabled when editing
  const [{ isDragging }, drag, dragPreview] = useDrag({
    type: ItemTypes.NOTE,
    item: () => {
      // Don't allow dragging when in edit mode
      if (isEditing) return null;
      onDragStart();
      return { id: note.id, text: note.content };
    },
    canDrag: () => !isEditing, // Disable dragging when in edit mode
    end: () => onDragEnd(),
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  });
  
  // Set up drop target - disabled when editing
  const [{ isOver }, drop] = useDrop({
    accept: ItemTypes.NOTE,
    canDrop: () => !isEditing, // Disable dropping when in edit mode
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
      
      // Disabled debug logging
      
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
      
      setDragPosition(newPosition);
    },
    drop: (item: { id: number }) => {
      // Removed debug logs
      
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
        return "before:absolute before:left-0 before:right-0 before:top-0 before:h-1.5 before:bg-lime-400 before:shadow-[0_0_8px_rgba(163,230,53,0.8)]";
      case 'after':
        return "after:absolute after:left-0 after:right-0 after:bottom-0 after:h-1.5 after:bg-lime-400 after:shadow-[0_0_8px_rgba(163,230,53,0.8)]";
      case 'first-child':
        return "before:absolute before:top-0 before:right-0 before:w-1.5 before:h-1/2 before:bg-lime-400 before:shadow-[0_0_8px_rgba(163,230,53,0.8)]";
      case 'child':
        return "after:absolute after:bottom-0 after:right-0 after:w-1.5 after:h-1/2 after:bg-lime-400 after:shadow-[0_0_8px_rgba(163,230,53,0.8)]";
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
    // Reduced debug logging
    const newNoteFlag = localStorage.getItem('newNoteCreated');
    const lastCreatedId = localStorage.getItem('lastCreatedNoteId');
    
    // Determine if this is a newly created note
    const isNewNoteByFlag = newNoteFlag === 'true' && note.content === '';
    const isNewNoteById = lastCreatedId && parseInt(lastCreatedId) === note.id;
    
    // If this is a newly created note...
    if ((isNewNoteByFlag || isNewNoteById) && !isEditing) {
      // Mark this note as newly created
      setIsNewlyCreated(true);
      
      // Clear the flags that apply to this note
      if (isNewNoteByFlag) {
        localStorage.removeItem('newNoteCreated');
      }
      
      if (isNewNoteById) {
        localStorage.removeItem('lastCreatedNoteId');
      }
      
      // Small delay to ensure this runs after the component is fully mounted
      setTimeout(() => {
        startEditing(note.id);
      }, 50);
    }
  }, [note.id, note.content, isEditing, isNewlyCreated]);

  // Track editing state with a ref to detect unexpected changes
  const isEditingRef = useRef(isEditing);
  
  // Intentionally track when a user deliberately exits edit mode
  const userExitedEditModeRef = useRef(false);
  
  // Effect to detect change in note data from server and preserve edit mode
  useEffect(() => {
    // Store reference to current edit state to prevent losing edit mode due to server data changes
    const wasEditing = isEditingRef.current;
    const userExited = userExitedEditModeRef.current;
    
    // Store current state for next comparison
    isEditingRef.current = isEditing;
    
    // Reset user exit flag after use
    if (userExited) {
      userExitedEditModeRef.current = false;
    }
    
    // Return early to avoid infinite render loop
    // This is crucial - we don't want to trigger setFormData if we don't have to
    if (!isEditing) {
      // If we lost edit mode without the user explicitly canceling or saving
      if (wasEditing && !isEditing && !userExited) {
        // Return to edit mode and preserve the editing state
        setTimeout(() => {
          startEditing(note.id);
        }, 50);
      }
      return;
    }
    
    // Sync form data with server data only when necessary
    // Create a memo of the current fields to avoid unnecessary rerenders
    const memoizedFields = JSON.stringify({
      content: note.content,
      url: note.url,
      linkText: note.linkText,
      youtubeLink: note.youtubeLink,
      time: note.time,
      isDiscussion: note.isDiscussion,
      images: note.images
    });
    
    // Store this in a ref to avoid triggering the effect on every render
    if (!noteDataRef.current || noteDataRef.current !== memoizedFields) {
      noteDataRef.current = memoizedFields;
      
      // Check if there are local changes
      let hasLocalChanges = false;
      
      // Create a new form object to check for changes
      const formValues = {
        content: note.content || "",
        url: note.url || "",
        linkText: note.linkText || "",
        youtubeLink: note.youtubeLink || "",
        time: note.time || "",
        isDiscussion: note.isDiscussion || false,
        images: [...(note.images || [])]
      };
      
      // Check if content field has been edited
      if (formData.content !== formValues.content) {
        hasLocalChanges = true;
      }
      
      // Only update form data if there are no local changes
      if (!hasLocalChanges) {
        setFormData(formValues);
      }
    }
  }, [note, isEditing]);
  
  // Check if note has a URL, YouTube link, or images for display purposes
  const hasUrl = !!note.url;
  const hasYouTube = !!note.youtubeLink;
  const hasImages = note.images && note.images.length > 0;
  
  // Check if note has any additional content (URL, YouTube, or images)
  const hasAdditionalContent = hasUrl || hasYouTube || hasImages || !!note.time;
  
  // Apply opacity to indicate dragging
  const opacity = isDragging ? 0.4 : 1;
  
  // If editing, show compact inline indicator and editor at top of screen
  if (isEditing) {
    return (
      <div ref={dragPreview} className="note-item pb-1.5 relative">
        {/* Small indicator where the note is in the tree - Fixed with proper styling */}
        <div className={`ml-${level * 3} p-3 rounded-md bg-blue-900/40 border border-blue-700 mb-3`}>
          <div className="text-sm text-blue-300 flex items-center">
            <div className="w-3 h-3 rounded-full bg-blue-500 mr-2"></div>
            <span className="font-medium">Currently editing</span>
          </div>
        </div>
        
        {/* Fixed-position editor */}
        <div className="fixed top-0 left-0 right-0 z-50 bg-gradient-to-b from-blue-950 to-gray-900 p-4 shadow-xl border-b-2 border-blue-500">
          {/* Edit mode title - simpler layout */}
          <div className="flex justify-between items-center mb-3">
            <h2 className="text-white font-bold text-lg">
              Edit Note
            </h2>
            
            <div className="flex space-x-2 items-center">
              <FullscreenToggle 
                className="mr-1"
                buttonClassName="h-8 bg-slate-800 hover:bg-slate-700 text-slate-300"
                iconClassName="h-4 w-4"
                showTooltip={false}
              />
              <Button
                size="sm"
                variant="outline"
                onClick={handleCancel}
                disabled={updateNote.isPending}
                className="h-8 border-red-500 hover:bg-red-900/30 text-red-300"
              >
                <X className="h-4 w-4 mr-1" /> Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleSave}
                disabled={updateNote.isPending}
                className="h-8 bg-blue-600 hover:bg-blue-700 text-white"
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
          
          {/* Main content textarea with prominent styling */}
          <div className="mb-3">
            <label className="block text-sm font-medium text-blue-300 mb-1">Content</label>
            <Textarea
              ref={contentInputRef}
              name="content"
              value={formData.content}
              onChange={handleInputChange}
              rows={3}
              placeholder="Note content..."
              className="w-full p-3 border-2 border-blue-700 focus:border-blue-500 rounded-md bg-gray-800 text-white select-text cursor-text shadow-inner"
              style={{ 
                userSelect: 'text', 
                WebkitUserSelect: 'text',
                MozUserSelect: 'text',
                msUserSelect: 'text',
                pointerEvents: 'auto'
              }}
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
            />
          </div>
          
          {/* Toggle button for additional fields with clear visual indicator */}
          <Button
            size="sm"
            variant={showAdditionalFields ? "default" : "outline"}
            className={`w-full mb-2 ${
              showAdditionalFields 
                ? 'bg-blue-700 hover:bg-blue-800 text-white' 
                : 'border-blue-600 text-blue-400 hover:text-blue-300'
            }`}
            onClick={() => setShowAdditionalFields(!showAdditionalFields)}
          >
            {showAdditionalFields ? (
              <>
                <ChevronDown className="h-4 w-4 mr-2" />
                Hide Additional Fields
              </>
            ) : (
              <>
                <ChevronRight className="h-4 w-4 mr-2" />
                {hasAdditionalContent 
                  ? "Show Additional Fields (Contains Data)" 
                  : "Show Additional Fields"
                }
              </>
            )}
          </Button>
          
          {/* Collapsible additional fields */}
          {showAdditionalFields && (
            <div className="space-y-2 text-sm">
              {/* URL fields */}
              <div className="flex items-center">
                <label className="font-medium text-white w-16 text-xs">URL</label>
                <Input
                  name="url"
                  type="text"
                  placeholder="https://..."
                  value={formData.url}
                  onChange={handleInputChange}
                  className="flex-1 select-text cursor-text text-xs h-8"
                  style={{ 
                    userSelect: 'text', 
                    WebkitUserSelect: 'text',
                    MozUserSelect: 'text',
                    msUserSelect: 'text',
                    pointerEvents: 'auto'
                  }}
                  onMouseDown={(e) => e.stopPropagation()}
                  onClick={(e) => e.stopPropagation()}
                />
              </div>
              
              {/* Link Text - only show if URL is present */}
              {formData.url && (
                <div className="flex items-center">
                  <label className="font-medium text-white w-16 text-xs">Link Text</label>
                  <Input
                    name="linkText"
                    type="text"
                    placeholder="Link description..."
                    value={formData.linkText}
                    onChange={handleInputChange}
                    className="flex-1 select-text cursor-text text-xs h-8"
                    style={{ 
                      userSelect: 'text', 
                      WebkitUserSelect: 'text',
                      MozUserSelect: 'text',
                      msUserSelect: 'text',
                      pointerEvents: 'auto'
                    }}
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={(e) => e.stopPropagation()}
                  />
                </div>
              )}
              
              {/* YouTube field */}
              <div className="flex items-center">
                <label className="font-medium text-white w-16 text-xs">YouTube</label>
                <Input
                  name="youtubeLink"
                  type="text"
                  placeholder="YouTube URL..."
                  value={formData.youtubeLink}
                  onChange={handleInputChange}
                  className="flex-1 select-text cursor-text text-xs h-8"
                  style={{ 
                    userSelect: 'text', 
                    WebkitUserSelect: 'text',
                    MozUserSelect: 'text',
                    msUserSelect: 'text',
                    pointerEvents: 'auto'
                  }}
                  onMouseDown={(e) => e.stopPropagation()}
                  onClick={(e) => e.stopPropagation()}
                />
              </div>
              
              {/* Time field - shown independently for presentation timing */}
              <div className="flex items-center">
                <label className="font-medium text-white w-16 text-xs">Time</label>
                <div className="flex items-center space-x-2">
                  <Input
                    name="time"
                    type="text"
                    placeholder="HH:MM"
                    value={formData.time}
                    onChange={handleInputChange}
                    className="w-24 select-text cursor-text text-xs h-8"
                    style={{ 
                      userSelect: 'text', 
                      WebkitUserSelect: 'text',
                      MozUserSelect: 'text',
                      msUserSelect: 'text',
                      pointerEvents: 'auto'
                    }}
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={(e) => e.stopPropagation()}
                  />
                  <div className="text-gray-400 text-[10px]">
                    for presentation timing
                  </div>
                </div>
              </div>
              
              {/* Discussion toggle - marks slide for interactive discussion */}
              <div className="flex items-center">
                <label className="font-medium text-white w-16 text-xs">Discussion</label>
                <div className="flex items-center space-x-2">
                  <Switch
                    checked={formData.isDiscussion}
                    onCheckedChange={(checked) => setFormData(prev => ({ ...prev, isDiscussion: checked }))}
                    className="data-[state=checked]:bg-blue-600"
                  />
                  <div className="text-gray-400 text-[10px]">
                    mark as discussion point
                  </div>
                </div>
              </div>
              
              {/* Image field */}
              <div className="flex flex-col">
                <label className="font-medium text-white mb-1 text-xs">Images</label>
                <FileUpload
                  onUpload={handleImageUpload}
                  onRemove={handleImageRemove}
                  existingImages={formData.images}
                />
              </div>
            </div>
          )}
        </div>
        
        {/* Spacer element to prevent content from being hidden under the fixed edit panel */}
        <div className="h-[200px]"></div>
      </div>
    );
  }

  // Normal display mode (not editing)
  return (
    <div ref={dragPreview} style={{ opacity }} className={`note-item pb-1.5 relative ${isDragging ? 'is-dragging' : ''} cursor-grab`}>
      <div ref={noteRef}>
        <div className={`ml-${level * 3}`}>
          <div
            style={{ 
              backgroundColor: getLevelColor(level).regular,
              color: "white" 
            }}
            className={`relative rounded-md p-3 shadow-sm border border-transparent hover:border-neutral-subtle group ${getDragIndicatorClass()}`}
            ref={drag}
            onMouseDown={(e) => e.stopPropagation()}
          >
            {/* Normal mode content */}
            <div>
              <div className="flex items-start">
                <div 
                  className="flex-1 cursor-text"
                  onDoubleClick={() => startEditing(note.id)}
                >
                  <p className={`text-white ${
                    level === 0 ? 'text-xl font-bold' : 
                    level === 1 ? 'text-lg font-semibold' : 
                    level === 2 ? 'text-base font-medium' : 
                    level === 3 ? 'text-base font-normal' : 
                    'text-sm font-normal'
                  }`}>
                    {note.content.split('\n')[0]}
                  </p>
                  {note.content.split('\n').length > 1 && (
                    <p className={`text-white text-opacity-80 ${
                      level <= 2 ? 'text-sm' : 'text-xs'
                    }`}>
                      {note.content.split('\n').slice(1).join('\n')}
                    </p>
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
                  {note.isDiscussion && (
                    <div className="text-blue-200" title="Discussion slide">
                      <Users className="h-4 w-4" />
                    </div>
                  )}
                  <button
                    className={`p-1 text-white hover:text-white ml-1 ${!hasChildren && 'opacity-0'}`}
                    onClick={toggleExpand}
                    title={isExpanded ? "Collapse" : "Expand"}
                  >
                    {isExpanded ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronRight className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>
              <div className="flex justify-between items-center mt-2">
                <div className="flex space-x-1 opacity-0 group-hover:opacity-100">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="p-1 h-auto text-blue-200 hover:bg-blue-900/40 hover:text-blue-100"
                    onClick={() => startEditing(note.id)}
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
                        isDiscussion: false,
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
                        isDiscussion: false,
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
                  <Button
                    size="sm"
                    variant="ghost"
                    className="p-1 h-auto text-blue-200 hover:bg-blue-900/40 hover:text-blue-100"
                    onClick={() => setIsMoveDialogOpen(true)}
                    title="Move note in tree"
                  >
                    <MoveVertical className="h-4 w-4" />
                  </Button>
                </div>
                <div className="flex items-center justify-end">
                  <div className="text-gray-400 opacity-40 group-hover:opacity-80 text-xs flex items-center space-x-1">
                    <GripVertical className="h-3 w-3 ml-1" />
                  </div>
                </div>
              </div>
              
              {/* URL display */}
              {note.url && (
                <div className="mt-2 text-sm">
                  <a
                    href={note.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-300 hover:text-blue-200 hover:underline flex items-center"
                  >
                    <Link className="h-3 w-3 mr-1 inline-block" />
                    {note.linkText || note.url}
                  </a>
                </div>
              )}
              
              {/* YouTube display */}
              {note.youtubeLink && (
                <div className="mt-2 text-sm">
                  <a
                    href={note.youtubeLink + (note.time ? `&t=${convertTimeToSeconds(note.time)}` : '')}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-red-300 hover:text-red-200 hover:underline flex items-center"
                  >
                    <Youtube className="h-3 w-3 mr-1 inline-block" />
                    YouTube {note.time && <span className="ml-1 text-yellow-300">@ {note.time}</span>}
                  </a>
                </div>
              )}
              
              {/* Images display */}
              {hasImages && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {note.images && note.images.map((image: string, idx: number) => (
                    <a 
                      key={idx} 
                      href={image} 
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block border-2 border-blue-800 rounded overflow-hidden hover:border-blue-600 transition-colors"
                    >
                      <img src={image} alt={`Note image ${idx + 1}`} className="h-16 w-auto object-cover" />
                    </a>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      
      {/* Delete confirmation dialog */}
      <ConfirmationDialog
        isOpen={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
        title="Delete Note"
        description={`Are you sure you want to delete "${note.content.substring(0, 40)}${note.content.length > 40 ? '...' : ''}"?`}
        confirmText="Delete"
        confirmVariant="destructive"
        onConfirm={handleDelete}
        isPending={deleteNote.isPending}
        extraContent={
          <div className="flex items-center space-x-2 mt-4">
            <Switch
              id="delete-children"
              checked={deleteChildren}
              onCheckedChange={setDeleteChildren}
            />
            <Label
              htmlFor="delete-children"
              className="font-normal text-sm cursor-pointer"
            >
              Also delete all child notes
            </Label>
          </div>
        }
      />
      
      {/* Move note dialog */}
      <MoveNoteDialog
        isOpen={isMoveDialogOpen}
        onOpenChange={setIsMoveDialogOpen}
        sourceNote={note}
        notes={allNotes}
        onMove={moveNote}
        isPending={false}
      />
    </div>
  );
}

// Helper function to convert time format (HH:MM:SS or MM:SS) to seconds for YouTube URLs
function convertTimeToSeconds(time: string): number {
  if (!time) return 0;
  
  const parts = time.split(':').map(part => parseInt(part, 10));
  
  if (parts.length === 3) {
    // HH:MM:SS format
    return (parts[0] * 3600) + (parts[1] * 60) + parts[2];
  } else if (parts.length === 2) {
    // MM:SS format
    return (parts[0] * 60) + parts[1];
  } else if (parts.length === 1 && !isNaN(parts[0])) {
    // Just seconds
    return parts[0];
  }
  
  return 0;
}

// Add the MoveNoteDialog at the end of the file
interface MoveNoteDialogProps {
  isMoveDialogOpen: boolean;
  setIsMoveDialogOpen: (open: boolean) => void;
  note: Note;
  allNotes: Note[];
  moveNote: (noteId: number, targetId: number, position: 'before' | 'after' | 'child' | 'first-child') => void;
}

function addMoveNoteDialog(props: MoveNoteDialogProps) {
  return (
    <MoveNoteDialog
      isOpen={props.isMoveDialogOpen}
      onOpenChange={props.setIsMoveDialogOpen}
      sourceNote={props.note}
      notes={props.allNotes}
      onMove={props.moveNote}
      isPending={false}
    />
  );
}