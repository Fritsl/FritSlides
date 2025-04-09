import React, { useState, useEffect } from 'react';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle,
  DialogFooter
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Loader2, Search, ExternalLink } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Note } from '@shared/schema';

interface SearchDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  notes: Note[];
  onSelectNote: (noteId: number) => void;
}

interface SearchResult {
  id: number;
  content: string;
  matchedText: string;
  parentId: number | null;
}

export function SearchDialog({ isOpen, onOpenChange, notes, onSelectNote }: SearchDialogProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Reset search when dialog opens
  useEffect(() => {
    if (isOpen) {
      setSearchQuery('');
      setSearchResults([]);
    }
  }, [isOpen]);

  // Handle search
  useEffect(() => {
    if (!searchQuery.trim() || !notes.length) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);

    // Simple debounce
    const timer = setTimeout(() => {
      const query = searchQuery.toLowerCase();
      
      // Perform the search through note content
      const results = notes
        .filter(note => {
          const content = note.content?.toLowerCase() || '';
          const linkText = note.linkText?.toLowerCase() || '';
          return content.includes(query) || linkText.includes(query);
        })
        .map(note => {
          const content = note.content || '';
          
          // Find the position of the match to highlight it
          const index = content.toLowerCase().indexOf(query);
          
          // Create a snippet around the matched text
          let matchedText = content;
          if (index >= 0) {
            const start = Math.max(0, index - 50);
            const end = Math.min(content.length, index + query.length + 50);
            matchedText = (start > 0 ? '...' : '') + 
                         content.substring(start, end) + 
                         (end < content.length ? '...' : '');
          }
          
          return {
            id: note.id,
            content: content,
            matchedText,
            parentId: note.parentId
          };
        });
        
      setSearchResults(results);
      setIsSearching(false);
    }, 300);
    
    return () => clearTimeout(timer);
  }, [searchQuery, notes]);

  // Handle selection
  const handleSelectNote = (noteId: number) => {
    onSelectNote(noteId);
    onOpenChange(false);
  };

  // Highlight matched text in results
  const highlightMatches = (text: string, query: string) => {
    if (!query.trim()) return text;
    
    const parts = text.split(new RegExp(`(${query})`, 'gi'));
    return parts.map((part, index) => 
      part.toLowerCase() === query.toLowerCase() 
        ? <mark key={index} className="bg-primary/30 px-0.5 rounded">{part}</mark> 
        : part
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Search className="w-5 h-5" />
            <span>Search Notes</span>
          </DialogTitle>
        </DialogHeader>
        
        <div className="mt-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search note content..."
              className="pl-8 pr-4"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              autoFocus
            />
          </div>
        </div>
        
        <div className="flex-1 min-h-0 mt-4">
          {isSearching ? (
            <div className="flex flex-col items-center justify-center h-48">
              <Loader2 className="h-8 w-8 animate-spin opacity-70" />
              <p className="mt-2 text-sm text-muted-foreground">Searching...</p>
            </div>
          ) : searchQuery && searchResults.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48">
              <p className="text-muted-foreground">No results found</p>
            </div>
          ) : (
            <ScrollArea className="h-[50vh]">
              <div className="space-y-2 pr-3">
                {searchResults.map((result) => (
                  <div 
                    key={result.id}
                    className="p-3 rounded-md border hover:border-primary cursor-pointer transition-colors"
                    onClick={() => handleSelectNote(result.id)}
                  >
                    <div className="flex justify-between items-start">
                      <div className="line-clamp-1 font-medium">
                        {result.content.split('\n')[0] || 'Untitled Note'}
                      </div>
                      <ExternalLink className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    </div>
                    <div className="mt-1 text-sm text-muted-foreground">
                      {highlightMatches(result.matchedText, searchQuery)}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </div>
        
        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}