import { useState, useCallback, useEffect } from "react";
import { DndProvider } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import { Note } from "@shared/schema";
import NoteItem from "./note-item";
import { Button } from "./button";
import { Plus, Loader2 } from "lucide-react";
import { useNotes } from "@/hooks/use-notes";

interface NoteTreeProps {
  projectId: number;
  notes: Note[];
  isLoading: boolean;
  expandLevel?: number; // Prop to control the expansion level
  onMaxDepthChange?: (maxDepth: number) => void; // Callback to notify the parent component of max depth
  focusedNoteId?: number | null; // New prop to explicitly focus on a specific note
  showOnlyTimedNotes?: boolean; // New prop to filter notes with time markers
}

export default function NoteTree({ 
  projectId, 
  notes, 
  isLoading, 
  expandLevel = -1, // Default to -1 which means no specific expansion level
  onMaxDepthChange,
  focusedNoteId = null, // New prop to focus on a specific note
  showOnlyTimedNotes = false // New prop to filter notes with time markers
}: NoteTreeProps) {
  const [expandedNodes, setExpandedNodes] = useState<Record<number, boolean>>({});
  const [draggingNoteId, setDraggingNoteId] = useState<number | null>(null);
  const [maxDepth, setMaxDepth] = useState(0);
  const { createNote, updateNoteParent, updateNoteOrder, editingNoteId } = useNotes(projectId);
  
  // Track if we've already expanded to the editing note
  const [focusedOnEditingNote, setFocusedOnEditingNote] = useState(false);
  
  // Track if we've already expanded to the explicitly focused note
  const [focusedOnSpecificNote, setFocusedOnSpecificNote] = useState(false);
  
  // Handle focusing on a specific note from URL parameters
  useEffect(() => {
    // Only run if we have notes, an editing note ID, and haven't focused yet
    if (notes?.length && editingNoteId && !focusedOnEditingNote) {
      console.log(`Focusing on note ID ${editingNoteId} from URL parameter`);
      
      // Find the note and all its ancestors
      const targetNote = notes.find(note => note.id === editingNoteId);
      if (!targetNote) {
        console.log(`Note ID ${editingNoteId} not found`);
        return;
      }
      
      // Build a path of parent IDs from the note up to the root
      const ancestorIds: number[] = [];
      let currentNote = targetNote;
      
      // Add all parent IDs to the path
      while (currentNote.parentId !== null) {
        const parent = notes.find(note => note.id === currentNote.parentId);
        if (!parent) break;
        
        ancestorIds.push(parent.id);
        currentNote = parent;
      }
      
      console.log(`Found ${ancestorIds.length} ancestors for note ${editingNoteId}:`, ancestorIds);
      
      // Create a new expanded nodes object that expands all ancestors
      const newExpandedNodes = { ...expandedNodes };
      ancestorIds.forEach(id => {
        newExpandedNodes[id] = true;
      });
      
      // Update expanded nodes state
      setExpandedNodes(newExpandedNodes);
      setFocusedOnEditingNote(true);
      
      // Since we found and handled the targeted note, scroll to it if possible
      setTimeout(() => {
        const noteElement = document.getElementById(`note-${editingNoteId}`);
        if (noteElement) {
          noteElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
          console.log(`Scrolled to note ${editingNoteId}`);
        } else {
          console.log(`Element for note ${editingNoteId} not found for scrolling`);
        }
      }, 100); // Short delay to allow rendering
    }
  }, [notes, editingNoteId, focusedOnEditingNote, expandedNodes]);
  
  // Handle focusing on a specific note that isn't being edited (from search or coming back from presentation)
  useEffect(() => {
    // Only run if we have notes, a focused note ID, and haven't focused yet
    if (notes?.length && focusedNoteId && !focusedOnSpecificNote) {
      console.log(`Explicitly focusing on note ID ${focusedNoteId} (not editing)`);
      
      // Find the note and all its ancestors
      const targetNote = notes.find(note => note.id === focusedNoteId);
      if (!targetNote) {
        console.log(`Note ID ${focusedNoteId} not found for focusing`);
        return;
      }
      
      // Build a path of parent IDs from the note up to the root
      const ancestorIds: number[] = [];
      let currentNote = targetNote;
      
      // Add all parent IDs to the path
      while (currentNote.parentId !== null) {
        const parent = notes.find(note => note.id === currentNote.parentId);
        if (!parent) break;
        
        ancestorIds.push(parent.id);
        currentNote = parent;
      }
      
      console.log(`Found ${ancestorIds.length} ancestors for focused note ${focusedNoteId}:`, ancestorIds);
      
      // Create a new expanded nodes object that expands all ancestors
      const newExpandedNodes = { ...expandedNodes };
      ancestorIds.forEach(id => {
        newExpandedNodes[id] = true;
      });
      
      // Update expanded nodes state
      setExpandedNodes(newExpandedNodes);
      setFocusedOnSpecificNote(true);
      
      // Scroll to the note
      setTimeout(() => {
        const noteElement = document.getElementById(`note-${focusedNoteId}`);
        if (noteElement) {
          noteElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
          // Add a temporary highlight class to the note
          noteElement.classList.add('highlight-focused-note');
          setTimeout(() => {
            noteElement.classList.remove('highlight-focused-note');
          }, 3000); // Remove the highlight after 3 seconds
          console.log(`Scrolled to focused note ${focusedNoteId}`);
        } else {
          console.log(`Element for focused note ${focusedNoteId} not found for scrolling`);
        }
      }, 100); // Short delay to allow rendering
    }
  }, [notes, focusedNoteId, focusedOnSpecificNote, expandedNodes]);

  // Calculate max depth of notes when notes change
  useEffect(() => {
    if (!notes || notes.length === 0) {
      setMaxDepth(0);
      if (onMaxDepthChange) onMaxDepthChange(0);
      return;
    }
    
    // First, create a map from parentId to child notes
    const notesByParent: Map<number | null, Note[]> = new Map();
    
    // Group notes by their parent
    notes.forEach(note => {
      const parentId = note.parentId;
      if (!notesByParent.has(parentId)) {
        notesByParent.set(parentId, []);
      }
      notesByParent.get(parentId)!.push(note);
    });
    
    // Function to recursively calculate depth
    const calculateDepth = (parentId: number | null, currentDepth: number): number => {
      const children = notesByParent.get(parentId) || [];
      if (children.length === 0) return currentDepth;
      
      // Get the max depth among all children
      let maxChildDepth = currentDepth;
      children.forEach(child => {
        const childDepth = calculateDepth(child.id, currentDepth + 1);
        maxChildDepth = Math.max(maxChildDepth, childDepth);
      });
      
      return maxChildDepth;
    };
    
    // Start at root level (parentId = null) with depth 0
    // Calculate the max depth, but use one less for consistency
    const maxTreeDepth = calculateDepth(null, 0);
    setMaxDepth(maxTreeDepth);
    
    // Notify parent component if callback provided, passing one less level
    if (onMaxDepthChange) onMaxDepthChange(Math.max(0, maxTreeDepth - 1));
  }, [notes, onMaxDepthChange]);
  
  // Handle expand level changes or when showing only timed notes
  useEffect(() => {
    // When showing only timed notes, expand all nodes for better visibility
    if (showOnlyTimedNotes) {
      const newExpandedState: Record<number, boolean> = {};
      notes.forEach(note => {
        newExpandedState[note.id] = true; // Expand all nodes
      });
      setExpandedNodes(newExpandedState);
      return;
    }
    
    // If expandLevel is -1, expand everything
    if (expandLevel === -1) {
      const newExpandedState: Record<number, boolean> = {};
      notes.forEach(note => {
        newExpandedState[note.id] = true; // Expand all nodes
      });
      setExpandedNodes(newExpandedState);
      return;
    }
    
    // Expand or collapse nodes based on their level
    const newExpandedState: Record<number, boolean> = {};
    
    // Function to recursively process nodes and set their expanded states
    const processNode = (noteId: number | null, level: number = 0) => {
      if (noteId === null) {
        // Process root level nodes
        const rootNodes = notes.filter(note => note.parentId === null);
        rootNodes.forEach(note => processNode(note.id, 0));
        return;
      }
      
      // For non-root nodes, set expanded state based on level
      if (level < expandLevel) {
        newExpandedState[noteId] = true; // Expand this node
        
        // Process its children
        const children = notes.filter(note => note.parentId === noteId);
        children.forEach(childNote => processNode(childNote.id, level + 1));
      } else {
        newExpandedState[noteId] = false; // Collapse this node
      }
    };
    
    // Start processing from root
    processNode(null);
    
    // Update expanded nodes state
    setExpandedNodes(newExpandedState);
  }, [expandLevel, notes, showOnlyTimedNotes]);

  // Build the hierarchical structure of notes
  const buildNoteTree = useCallback(() => {
    const noteMap = new Map<number | null, Note[]>();
    
    // Create a filtered array based on the showOnlyTimedNotes flag
    const filteredNotes = showOnlyTimedNotes 
      ? notes.filter(note => note.time && note.time.trim().length > 0)
      : notes;
    
    // Group notes by parentId
    filteredNotes.forEach(note => {
      const parentId = note.parentId ?? null;
      if (!noteMap.has(parentId)) {
        noteMap.set(parentId, []);
      }
      noteMap.get(parentId)!.push(note);
    });
    
    // Sort each group by order
    noteMap.forEach(noteGroup => {
      noteGroup.sort((a, b) => Number(a.order) - Number(b.order));
    });
    
    return noteMap;
  }, [notes, showOnlyTimedNotes]);

  // Get children for a note
  const getChildren = useCallback((noteId: number | null, noteMap: Map<number | null, Note[]>) => {
    return noteMap.get(noteId) || [];
  }, []);

  // Check if a note has children
  const hasChildren = useCallback((noteId: number, noteMap: Map<number | null, Note[]>) => {
    return noteMap.has(noteId) && noteMap.get(noteId)!.length > 0;
  }, []);

  // Toggle expanded state of a node
  const toggleExpand = useCallback((noteId: number) => {
    setExpandedNodes(prev => ({
      ...prev,
      [noteId]: !prev[noteId]
    }));
  }, []);

  // Check if moving a note would create a circular reference
  const canDrop = useCallback((sourceId: number, targetId: number = 0, position: string = "child") => {
    if (sourceId === targetId) return false;
    if (position !== "child") return true;
    
    // Check if target is a descendant of source
    const isDescendant = (checkId: number, ancestorId: number): boolean => {
      const note = notes.find(n => n.id === checkId);
      if (!note) return false;
      if (note.parentId === ancestorId) return true;
      if (note.parentId) return isDescendant(note.parentId, ancestorId);
      return false;
    };
    
    return !isDescendant(targetId, sourceId);
  }, [notes]);

  // Move a note to a new position (update parent and/or order)
  const moveNote = useCallback((noteId: number, targetId: number, position: 'before' | 'after' | 'child' | 'first-child') => {
    console.log(`=== MOVE NOTE DEBUG ===`);
    console.log(`Moving noteId ${noteId} to position ${position} relative to noteId ${targetId}`);
    
    const sourceNote = notes.find(n => n.id === noteId);
    const targetNote = notes.find(n => n.id === targetId);
    
    console.log('Source note:', sourceNote);
    console.log('Target note:', targetNote);
    
    if (!sourceNote || !targetNote) {
      console.log('Source or target note not found, aborting');
      return;
    }
    
    if (position === 'child' || position === 'first-child') {
      console.log(`Making note ${noteId} a ${position} of note ${targetId}`);
      
      // Make source a child of target
      if (sourceNote.parentId === targetId && position === 'child') {
        console.log('Already a child of target and not specifically first-child, aborting');
        return; // Already a child (and not specifically a first-child)
      }
      
      let newOrder: string = "0";
      
      if (position === 'first-child') {
        // Set as first child - need to find the current first child to place before it
        const childNotes = notes.filter(n => n.parentId === targetId);
        console.log('Existing child notes:', childNotes);
        
        if (childNotes.length > 0) {
          // Find the child with the smallest order
          const firstChild = childNotes.reduce((prev, current) => 
            Number(prev.order) < Number(current.order) ? prev : current
          );
          // Convert the order to string for consistency
          newOrder = String(Number(firstChild.order) - 1);
          console.log(`Found first child with order ${firstChild.order}, setting new order to ${newOrder}`);
        } else {
          console.log('No existing children, using default order 0');
          newOrder = "0"; // Set default order as string
        }
      }
      
      console.log(`Updating note parent: noteId=${noteId}, parentId=${targetId}, order=${position === 'first-child' ? newOrder : 'undefined'}`);
      updateNoteParent.mutate({ 
        noteId, 
        parentId: targetId,
        order: position === 'first-child' ? newOrder : undefined
      });
      
      // Expand the target to show the newly moved child
      setExpandedNodes(prev => ({
        ...prev,
        [targetId]: true
      }));
    } else {
      console.log(`Moving note ${noteId} as sibling ${position} note ${targetId}`);
      
      // Move as sibling
      const siblings = notes.filter(n => n.parentId === targetNote.parentId);
      siblings.sort((a, b) => Number(a.order) - Number(b.order));
      
      console.log('Siblings (sorted by order):', siblings);
      
      const targetIndex = siblings.findIndex(n => n.id === targetId);
      console.log(`Target index in siblings array: ${targetIndex}`);
      
      // Find the note before and after the target in sorted order for better positioning
      const prevNote = targetIndex > 0 ? siblings[targetIndex - 1] : null;
      const nextNote = targetIndex < siblings.length - 1 ? siblings[targetIndex + 1] : null;
      
      console.log('Previous sibling:', prevNote);
      console.log('Next sibling:', nextNote);
      
      // Calculate order based on surrounding notes
      let newOrder: string;
      if (position === 'before') {
        if (prevNote) {
          // Place between prev and target
          newOrder = String((Number(prevNote.order) + (Number(targetNote.order) - Number(prevNote.order)) / 2));
        } else {
          // Place before the first item
          newOrder = String(Number(targetNote.order) - 0.5);
        }
      } else { // after
        if (nextNote) {
          // Place between target and next
          newOrder = String(Number(targetNote.order) + (Number(nextNote.order) - Number(targetNote.order)) / 2);
        } else {
          // Place after the last item
          newOrder = String(Number(targetNote.order) + 0.5);
        }
      }
      
      console.log(`Position: ${position}`);
      console.log(`Previous note order: ${prevNote?.order}, Target note order: ${targetNote.order}, Next note order: ${nextNote?.order}`);
      console.log(`New calculated order: ${newOrder}`);
      
      console.log(`Target note order: ${targetNote.order}, new calculated order: ${newOrder}`);
      
      // Since we now have optimistic updates in our hooks, we can simplify this
      // First, update parent if needed, then update order (both done optimistically in the UI)
      if (sourceNote.parentId !== targetNote.parentId) {
        console.log(`Updating parent from ${sourceNote.parentId} to ${targetNote.parentId}`);
        
        // Update parent first, then order
        updateNoteParent.mutate({ 
          noteId: sourceNote.id, 
          parentId: targetNote.parentId,
          order: newOrder // Pass the order along with the parent update for a single optimistic update
        });
      } else {
        // Only update the order if the parent is the same
        console.log(`Updating note order: noteId=${sourceNote.id}, order=${newOrder}`);
        updateNoteOrder.mutate({ 
          noteId: sourceNote.id, 
          order: newOrder 
        });
      }
    }
  }, [notes, updateNoteParent, updateNoteOrder]);

  // Render a node and its children
  const renderNoteItems = useCallback((
    parentId: number | null, 
    noteMap: Map<number | null, Note[]>,
    level = 0
  ) => {
    const children = getChildren(parentId, noteMap);
    
    if (children.length === 0) {
      return null;
    }
    
    return children.map(note => {
      const hasChildNodes = hasChildren(note.id, noteMap);
      const isExpanded = !!expandedNodes[note.id];
      
      return (
        <div key={note.id}>
          <NoteItem
            note={note}
            level={level}
            projectId={projectId}
            hasChildren={hasChildNodes}
            isExpanded={isExpanded}
            toggleExpand={() => toggleExpand(note.id)}
            onDragStart={() => setDraggingNoteId(note.id)}
            onDragEnd={() => setDraggingNoteId(null)}
            canDrop={sourceId => canDrop(sourceId, note.id)}
            moveNote={moveNote}
            createNote={createNote}
            allNotes={notes}
          />
          
          {/* Render children if expanded */}
          {hasChildNodes && isExpanded && (
            <div className="pl-8">
              {renderNoteItems(note.id, noteMap, level + 1)}
            </div>
          )}
        </div>
      );
    });
  }, [
    expandedNodes, 
    getChildren, 
    hasChildren, 
    toggleExpand, 
    canDrop, 
    moveNote, 
    projectId,
    createNote,
    notes
  ]);

  // Create a new root note
  const handleAddRootNote = () => {
    // Set a temporary flag in localStorage to indicate a new note is being created
    localStorage.setItem('newNoteCreated', 'true');
    
    // Find the maximum order value among existing root notes
    let maxOrder = -1;
    if (notes && notes.length > 0) {
      const rootNotes = notes.filter(n => n.parentId === null);
      if (rootNotes.length > 0) {
        rootNotes.forEach(note => {
          const orderValue = parseFloat(note.order.toString());
          if (!isNaN(orderValue) && orderValue > maxOrder) {
            maxOrder = orderValue;
          }
        });
      }
    }
    
    // Use an order value higher than any existing note to place it at the end
    const newOrderValue = (maxOrder + 1).toString();
    console.log(`Creating new root note with order ${newOrderValue} (max order was ${maxOrder})`);
    
    // Cast as any to avoid TypeScript errors from TanStack Query
    (createNote.mutate as any)({
      content: "",
      parentId: null,
      projectId: projectId,
      url: "",
      linkText: "",
      youtubeLink: "",
      time: "",
      images: [],
      order: newOrderValue // Send as string to match the server's expected type
    });
  };

  // Build the note tree
  const noteMap = buildNoteTree();

  // If loading, show a spinner
  if (isLoading) {
    return (
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="ml-2">Loading notes...</span>
        </div>
      </div>
    );
  }

  return (
    <DndProvider backend={HTML5Backend}>
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 overflow-auto p-2">
          <div id="noteTree" className="w-full">
            {/* Root level notes */}
            {renderNoteItems(null, noteMap)}
            
            {/* Empty state with add button */}
            {(!notes || notes.length === 0) && (
              <div className="note-item mt-4 opacity-70 hover:opacity-100">
                <div 
                  className="flex items-center justify-center p-3 border border-dashed border-neutral-muted rounded-md cursor-pointer hover:border-primary hover:bg-white"
                  onClick={handleAddRootNote}
                >
                  <Plus className="h-5 w-5 text-neutral-muted" />
                  <span className="ml-2 text-sm text-neutral-muted">Add a new note</span>
                </div>
              </div>
            )}
            
            {/* Add button if there are already notes */}
            {notes && notes.length > 0 && (
              <div className="mt-4">
                <Button 
                  variant="outline" 
                  className="w-full border-dashed" 
                  onClick={handleAddRootNote}
                  disabled={createNote.isPending}
                >
                  {createNote.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <Plus className="h-4 w-4 mr-2" />
                      Add a new note
                    </>
                  )}
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </DndProvider>
  );
}
