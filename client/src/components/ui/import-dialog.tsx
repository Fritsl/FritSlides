import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { AlertCircle, Upload, CheckCircle2 } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface ImportDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: number;
}

export function ImportDialog({
  isOpen,
  onOpenChange,
  projectId
}: ImportDialogProps) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  
  const importMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", `/api/projects/${projectId}/import`, data);
      return await res.json();
    },
    onSuccess: () => {
      // Invalidate notes query to refresh notes list
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/notes`] });
      toast({
        title: "Import successful",
        description: "Your notes have been imported",
      });
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Import failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });
  
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] || null;
    setSelectedFile(file);
    setParseError(null);
  };
  
  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const file = event.dataTransfer.files?.[0] || null;
    setSelectedFile(file);
    setParseError(null);
  };
  
  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
  };
  
  const handleImport = async () => {
    if (!selectedFile) {
      toast({
        title: "No file selected",
        description: "Please select a file to import",
        variant: "destructive",
      });
      return;
    }
    
    try {
      // Read and parse the file
      const text = await selectedFile.text();
      const data = JSON.parse(text);
      
      // Check if the data has the right structure
      if (!data.notes || !Array.isArray(data.notes)) {
        setParseError("Invalid file format. The file must contain a 'notes' array.");
        return;
      }
      
      // Import the notes
      importMutation.mutate(data);
    } catch (error) {
      setParseError("Error parsing file. Please make sure it's a valid JSON file.");
    }
  };
  
  const clearFile = () => {
    setSelectedFile(null);
    setParseError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Import Notes</DialogTitle>
          <DialogDescription>
            Import notes from a JSON file exported from NoteDrop.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div 
            className={`border-2 border-dashed rounded-md p-6 text-center cursor-pointer transition-colors ${
              selectedFile ? 'border-green-500 bg-green-50 dark:bg-green-950/20' : 'border-muted-foreground/25 hover:border-muted-foreground/50'
            }`}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept=".json"
              className="hidden"
            />
            
            {selectedFile ? (
              <div className="flex flex-col items-center">
                <CheckCircle2 className="h-8 w-8 text-green-500 mb-2" />
                <div className="text-sm font-medium">{selectedFile.name}</div>
                <div className="text-xs text-muted-foreground mt-1">
                  {Math.round(selectedFile.size / 1024)} KB
                </div>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={(e) => { 
                    e.stopPropagation();
                    clearFile();
                  }}
                  className="mt-2"
                >
                  Change File
                </Button>
              </div>
            ) : (
              <div className="flex flex-col items-center">
                <Upload className="h-8 w-8 text-muted-foreground mb-2" />
                <Label className="text-sm font-medium">
                  Drop your file here or click to browse
                </Label>
                <p className="text-xs text-muted-foreground mt-1">
                  Supports JSON files exported from NoteDrop
                </p>
              </div>
            )}
          </div>
          
          {parseError && (
            <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-md flex items-start">
              <AlertCircle className="h-4 w-4 mr-2 mt-0.5 flex-shrink-0" />
              <span>{parseError}</span>
            </div>
          )}
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleImport} 
            disabled={!selectedFile || importMutation.isPending}
          >
            {importMutation.isPending ? (
              <>
                <Upload className="h-4 w-4 mr-2 animate-spin" />
                Importing...
              </>
            ) : (
              <>
                <Upload className="h-4 w-4 mr-2" />
                Import
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}