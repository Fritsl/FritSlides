import { useState, useRef, useEffect } from "react";
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
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { AlertCircle, Upload, CheckCircle2, Loader2 } from "lucide-react";
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
  const [noteCount, setNoteCount] = useState<number | null>(null);
  const [progress, setProgress] = useState<number>(0);
  
  const [statusLog, setStatusLog] = useState<string[]>([]);
  const [currentStatus, setCurrentStatus] = useState<string>("");
  const logContainerRef = useRef<HTMLDivElement>(null);
  
  const importMutation = useMutation({
    mutationFn: async (data: any) => {
      // Reset progress and save the note count for tracking
      setProgress(0);
      setStatusLog([]);
      
      if (data.notes && Array.isArray(data.notes)) {
        setNoteCount(data.notes.length);
        // Add first status message
        setCurrentStatus(`Starting import of ${data.notes.length} notes...`);
        setStatusLog(prev => [...prev, `Starting import of ${data.notes.length} notes...`]);
      }
      
      const res = await apiRequest("POST", `/api/projects/${projectId}/import`, data);
      return await res.json();
    },
    onSuccess: (data) => {
      // Set progress to 100% on success
      setProgress(100);
      
      // Invalidate notes query to refresh notes list
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/notes`] });
      
      // Extract and display the status log from the server
      if (data.statusLog && Array.isArray(data.statusLog)) {
        setStatusLog(data.statusLog);
        // Set the last status message as current
        if (data.statusLog.length > 0) {
          setCurrentStatus(data.statusLog[data.statusLog.length - 1]);
        }
      }
      
      // Display import success with count information
      toast({
        title: "Import successful",
        description: `${data.count} notes have been imported in ${data.timeElapsed || '?'} seconds`,
      });
      
      // Don't automatically close dialog so user can see the import log
      // Just reset the file selection
      setNoteCount(null);
    },
    onError: (error: Error) => {
      // Reset status on error
      setNoteCount(null);
      setProgress(0);
      setCurrentStatus("Import failed");
      
      toast({
        title: "Import failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });
  
  // Set up an interval for simulated progress when importing
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    
    if (importMutation.isPending && noteCount) {
      // Start at 5% to show immediate feedback
      setProgress(5);
      
      // Simulate progress up to 60% for first pass (note creation)
      // Then 60-90% for second pass (parent relationships)
      // The remaining 10% will be set when the operation completes
      interval = setInterval(() => {
        setProgress(prev => {
          // First phase (note creation) - faster progress
          if (prev < 60) {
            const increment = prev < 30 ? 5 : 3;
            return Math.min(prev + increment, 60);
          } 
          // Second phase (slower for parent relationships)
          else {
            // Slower progress during parent relationship processing
            return Math.min(prev + 0.5, 90);
          }
        });
      }, 200);

      // Add extra info for users about long imports
      if (noteCount > 50) {
        toast({
          title: "Large Import Detected",
          description: "This import may take a few minutes. The app will remain functional during import.",
          duration: 6000,
        });
      }
    } else if (!importMutation.isPending && !importMutation.isSuccess) {
      // Reset progress when not pending and not successful
      setProgress(0);
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [importMutation.isPending, importMutation.isSuccess, noteCount, toast]);
  
  // Auto-scroll the log container to the bottom whenever statusLog changes
  useEffect(() => {
    if (logContainerRef.current && statusLog.length > 0) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [statusLog]);
  
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
      <DialogContent className="sm:max-w-[525px]">
        <DialogHeader>
          <DialogTitle>Import Notes</DialogTitle>
          <DialogDescription>
            Import notes from a JSON file exported from FritSlides.
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
                  Supports JSON files exported from FritSlides
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
          
          {/* Progress indicator during import */}
          {((importMutation.isPending && noteCount) || (progress === 100)) && (
            <div className="pt-2">
              <div className="flex justify-between items-center mb-2 text-sm">
                <span className={progress === 100 ? "text-green-600 dark:text-green-400" : "text-muted-foreground"}>
                  {progress === 100 ? "Import completed!" : "Importing notes..."}
                </span>
                <span className="text-muted-foreground">
                  {noteCount ? `${noteCount} notes total` : ""}
                </span>
              </div>
              <Progress 
                value={progress} 
                className={`h-2 ${progress === 100 ? "bg-green-100 dark:bg-green-900/20" : ""}`} 
              />
              
              {/* Import status and log section */}
              <div className="mt-2">
                <div className="flex items-center mb-1">
                  {progress === 100 ? (
                    <>
                      <CheckCircle2 className="h-4 w-4 mr-2 text-green-600 dark:text-green-400" />
                      <span className="text-xs text-green-600 dark:text-green-400">All notes imported successfully</span>
                    </>
                  ) : (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin text-primary" />
                      <span className="text-xs text-muted-foreground">
                        {currentStatus || "Processing..."}
                      </span>
                    </>
                  )}
                </div>
                
                {/* Status log display */}
                {statusLog.length > 0 && (
                  <div 
                    ref={logContainerRef}
                    className="mt-2 border rounded-md p-2 h-32 overflow-y-auto text-xs text-muted-foreground"
                  >
                    <div className="font-medium mb-1">Import Progress Log:</div>
                    {statusLog.map((log, index) => (
                      <div key={index} className="py-0.5 border-b border-dashed border-border/40 last:border-0">
                        {log}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
        
        <DialogFooter>
          <Button 
            variant="outline" 
            onClick={() => onOpenChange(false)}
            disabled={importMutation.isPending}
          >
            Cancel
          </Button>
          <Button 
            onClick={handleImport} 
            disabled={!selectedFile || importMutation.isPending}
            className={importMutation.isPending ? "opacity-80" : ""}
          >
            {importMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                {noteCount ? `Importing ${noteCount} notes...` : "Importing..."}
              </>
            ) : (
              <>
                <Upload className="h-4 w-4 mr-2" />
                {selectedFile && selectedFile.name ? 'Import' : 'Select File'}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}