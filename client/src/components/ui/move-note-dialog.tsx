import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "./dialog";
import { Button } from "./button";
import { ScrollArea } from "./scroll-area";
import { Check, ChevronRight, FolderTree, Loader2, MoveVertical } from "lucide-react";
import { Note } from "@shared/schema";
import { getLevelColor } from "@/lib/colors";

interface MoveNoteDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  sourceNote: Note | null;
  notes: Note[] | undefined;
  onMove: (sourceId: number, targetId: number, position: 'before' | 'after' | 'child' | 'first-child') => void;
  isPending: boolean;
}

// Helper function to check if a note is a descendant of another note
const isDescendant = (noteId: number, potentialParentId: number, notes: Note[]): boolean => {
  if (noteId === potentialParentId) return true;
  
  const potentialChildren = notes.filter(note => note.parentId === potentialParentId);
  return potentialChildren.some(child => isDescendant(noteId, child.id, notes));
};

// Helper to get note data by ID
const getNoteById = (id: number | null, notes: Note[]): Note | undefined => {
  if (id === null) return undefined;
  return notes.find(note => note.id === id);
};

// Function to build a tree from flat notes
const buildNoteTree = (notes: Note[], parentId: number | null = null): Note[] => {
  return notes
    .filter(note => note.parentId === parentId)
    .sort((a, b) => {
      const orderA = parseFloat(String(a.order)) || 0;
      const orderB = parseFloat(String(b.order)) || 0;
      return orderA - orderB;
    });
};

export function MoveNoteDialog({
  isOpen,
  onOpenChange,
  sourceNote,
  notes,
  onMove,
  isPending
}: MoveNoteDialogProps) {
  const [selectedNoteId, setSelectedNoteId] = useState<number | null>(null);
  const [selectedPosition, setSelectedPosition] = useState<'before' | 'after' | 'child'>('after');
  
  // Reset selection when dialog opens
  useEffect(() => {
    if (isOpen) {
      setSelectedNoteId(null);
      setSelectedPosition('after');
    }
  }, [isOpen]);
  
  // If notes or sourceNote is not available, show loading
  if (!notes || !sourceNote) {
    return (
      <Dialog open={isOpen} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Loading...</DialogTitle>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    );
  }
  
  // Build the tree structure for display
  const rootNotes = buildNoteTree(notes, null);
  
  // Find the selected note data
  const selectedNote = getNoteById(selectedNoteId, notes);
  
  // Check if we can place this note as a child of the selected note
  // We can't if the selected note is a descendant of the source note (to avoid cycles)
  const canAddAsChild = selectedNoteId !== null && 
    selectedNoteId !== sourceNote.id && 
    !isDescendant(selectedNoteId, sourceNote.id, notes);
  
  // Handle the move action
  const handleMove = () => {
    if (!selectedNoteId || !sourceNote) return;
    
    onMove(sourceNote.id, selectedNoteId, selectedPosition);
    onOpenChange(false);
  };
  
  // Recursive component to render the tree
  const renderNoteTree = (noteList: Note[], level: number = 0) => {
    return noteList.map(note => {
      // Skip the source note and its descendants to avoid cycles
      if (note.id === sourceNote.id || isDescendant(sourceNote.id, note.id, notes)) {
        return null;
      }
      
      const children = buildNoteTree(notes, note.id);
      const hasChildren = children.length > 0;
      const isSelected = selectedNoteId === note.id;
      const color = getLevelColor(level);
      
      return (
        <div key={note.id} className="mb-1">
          <div 
            className={`p-2 rounded-md cursor-pointer flex items-center transition-colors ${
              isSelected ? 'border-2 border-lime-400 shadow-[0_0_5px_rgba(163,230,53,0.5)]' : 'border border-transparent hover:border-gray-600'
            }`}
            style={{ 
              backgroundColor: isSelected ? `${color.regular}` : `${color.regular}80`,
            }}
            onClick={() => setSelectedNoteId(note.id)}
          >
            <div className="w-6">
              {isSelected && <Check size={16} className="text-white" />}
            </div>
            <div className="flex-1 text-white truncate">
              {note.content.split('\n')[0]}
            </div>
          </div>
          
          {hasChildren && (
            <div className="ml-4 mt-1 pl-2 border-l border-gray-700">
              {renderNoteTree(children, level + 1)}
            </div>
          )}
        </div>
      );
    });
  };
  
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center">
            <MoveVertical className="mr-2 h-5 w-5" />
            Move Note
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 my-2">
          {/* Source note info */}
          <div className="bg-gray-800 p-3 rounded-md">
            <p className="text-sm text-gray-400 mb-1">Moving note:</p>
            <p className="font-medium text-white truncate">{sourceNote.content.split('\n')[0]}</p>
          </div>
          
          {/* Select note */}
          <div>
            <p className="mb-2 text-sm font-medium">Select where to move the note:</p>
            <div className="bg-gray-900 border border-gray-700 rounded-md">
              {notes.length === 0 ? (
                <p className="p-4 text-center text-gray-400">No notes available</p>
              ) : (
                <ScrollArea className="h-[200px] p-2">
                  {renderNoteTree(rootNotes)}
                </ScrollArea>
              )}
            </div>
          </div>
          
          {/* Position selection - only available when a note is selected */}
          {selectedNoteId && (
            <div>
              <p className="mb-2 text-sm font-medium">Choose position:</p>
              <div className="flex space-x-2">
                <Button 
                  variant={selectedPosition === 'before' ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedPosition('before')}
                  className="flex-1"
                >
                  <div className="flex items-center">
                    <div className="mr-2">↑</div>
                    <div>Before</div>
                  </div>
                </Button>
                <Button 
                  variant={selectedPosition === 'after' ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedPosition('after')}
                  className="flex-1"
                >
                  <div className="flex items-center">
                    <div className="mr-2">↓</div>
                    <div>After</div>
                  </div>
                </Button>
                <Button 
                  variant={selectedPosition === 'child' ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedPosition('child')}
                  className="flex-1"
                  disabled={!canAddAsChild}
                  title={!canAddAsChild ? "Cannot add as child to prevent circular references" : ""}
                >
                  <div className="flex items-center">
                    <div className="mr-2">→</div>
                    <div>Child</div>
                  </div>
                </Button>
              </div>
            </div>
          )}
        </div>
        
        <DialogFooter>
          <Button 
            variant="outline" 
            onClick={() => onOpenChange(false)}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button 
            onClick={handleMove} 
            disabled={!selectedNoteId || isPending}
          >
            {isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Moving...
              </>
            ) : (
              <>
                <FolderTree className="mr-2 h-4 w-4" />
                Move Note
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}