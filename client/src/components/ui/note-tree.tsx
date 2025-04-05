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
}

export default function NoteTree({ projectId, notes, isLoading }: NoteTreeProps) {
  const [expandedNodes, setExpandedNodes] = useState<Record<number, boolean>>({});
  const [draggingNoteId, setDraggingNoteId] = useState<number | null>(null);
  const { createNote, updateNoteParent, updateNoteOrder } = useNotes(projectId);

  // Build the hierarchical structure of notes
  const buildNoteTree = useCallback(() => {
    const noteMap = new Map<number | null, Note[]>();
    
    // Group notes by parentId
    notes.forEach(note => {
      const parentId = note.parentId ?? null;
      if (!noteMap.has(parentId)) {
        noteMap.set(parentId, []);
      }
      noteMap.get(parentId)!.push(note);
    });
    
    // Sort each group by order
    noteMap.forEach(noteGroup => {
      noteGroup.sort((a, b) => a.order - b.order);
    });
    
    return noteMap;
  }, [notes]);

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
  const moveNote = useCallback((noteId: number, targetId: number, position: 'before' | 'after' | 'child') => {
    const sourceNote = notes.find(n => n.id === noteId);
    const targetNote = notes.find(n => n.id === targetId);
    
    if (!sourceNote || !targetNote) return;
    
    if (position === 'child') {
      // Make source a child of target
      if (sourceNote.parentId === targetId) return; // Already a child
      
      updateNoteParent.mutate({ noteId, parentId: targetId });
      
      // Expand the target to show the newly moved child
      setExpandedNodes(prev => ({
        ...prev,
        [targetId]: true
      }));
    } else {
      // Move as sibling
      const siblings = notes.filter(n => n.parentId === targetNote.parentId);
      siblings.sort((a, b) => a.order - b.order);
      
      const targetIndex = siblings.findIndex(n => n.id === targetId);
      const newOrder = position === 'before' 
        ? targetNote.order - 0.5 
        : targetNote.order + 0.5;
      
      // Update parent if needed
      if (sourceNote.parentId !== targetNote.parentId) {
        updateNoteParent.mutate({ 
          noteId: sourceNote.id, 
          parentId: targetNote.parentId 
        });
      }
      
      // Update order
      updateNoteOrder.mutate({ 
        noteId: sourceNote.id, 
        order: newOrder 
      });
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
    projectId
  ]);

  // Create a new root note
  const handleAddRootNote = () => {
    createNote.mutate({
      content: "",
      parentId: null,
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
