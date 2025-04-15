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
  
  // Create a ref to hold the status update interval
  const statusIntervalRef = useRef<NodeJS.Timeout | undefined>(undefined);
  
  // State for import ID from server
  const [importId, setImportId] = useState<string | null>(null);
  
  const importMutation = useMutation({
    mutationFn: async (data: any) => {
      // Reset progress and save the note count for tracking
      setProgress(5); // Start with some visible progress immediately
      setStatusLog([]);
      setImportId(null);
      
      // Clear any existing intervals
      if (statusIntervalRef.current) {
        clearInterval(statusIntervalRef.current);
        statusIntervalRef.current = undefined;
      }
      
      if (data.notes && Array.isArray(data.notes)) {
        setNoteCount(data.notes.length);
        // Add first status message
        const startMsg = `Preparing to import ${data.notes.length} notes...`;
        setCurrentStatus(startMsg);
        setStatusLog([startMsg]);
        
        // Set up a progress indicator that moves forward even if we don't get server updates
        // This ensures users always see something happening
        let progressTimer = setInterval(() => {
          setProgress((prev) => {
            // Only increment automatically up to 80% to leave room for actual completion
            if (prev < 80) {
              return prev + 0.5; // Slow, steady progress
            }
            return prev;
          });
        }, 500);
        
        try {
          // Start the import process
          console.log("Sending import data:", JSON.stringify(data, null, 2).substring(0, 200) + "...");
          setCurrentStatus(`Sending data to server...`);
          setStatusLog(prev => [...prev, `Sending ${data.notes.length} notes to server...`]);
          
          // Set a longer timeout for large imports (3 minutes)
          const res = await apiRequest("POST", `/api/projects/${projectId}/import`, data, {
            timeout: 180000 // 3 minutes timeout
          });
          
          // Set progress to indicate successful server contact
          setProgress(15);
          setCurrentStatus(`Server processing started...`);
          setStatusLog(prev => [...prev, `Server has started processing the import...`]);
          
          // Log response status for debugging
          console.log("Import response status:", res.status);
          
          const importData = await res.json();
          console.log("Import started with response:", importData);
          
          // Check if the server returned an import ID for status polling
          if (importData.importId) {
            console.log("Got import ID:", importData.importId);
            setImportId(importData.importId);
            setCurrentStatus(`Processing import job #${importData.importId}...`);
            setStatusLog(prev => [...prev, `Created import job #${importData.importId} - processing started`]);
            
            // Set progress to indicate active processing
            setProgress(20);
            
            // Track last progress update time to handle stalled imports
            let lastProgressUpdate = Date.now();
            
            // Start polling for real-time status updates
            statusIntervalRef.current = setInterval(async () => {
              try {
                // Poll the server for current status
                console.log("Polling status for import ID:", importData.importId);
                const statusRes = await apiRequest(
                  "GET", 
                  `/api/projects/${projectId}/import/${importData.importId}/status`
                );
                const statusData = await statusRes.json();
                
                // Reset stall detection timer since we got a response
                lastProgressUpdate = Date.now();
                
                // Update our UI with the server's status information
                if (statusData.statusLog && Array.isArray(statusData.statusLog)) {
                  setStatusLog(statusData.statusLog);
                  
                  // If we have new log entries, update the current status message
                  if (statusData.statusLog.length > 0) {
                    setCurrentStatus(statusData.statusLog[statusData.statusLog.length - 1]);
                  }
                }
                
                // Update progress bar from server data if available
                if (typeof statusData.progress === 'number') {
                  // Ensure progress is at least 20% once we're actively processing
                  const serverProgress = Math.max(statusData.progress, 20);
                  setProgress(serverProgress);
                  
                  // If we're making progress, clear the automatic progress timer
                  if (serverProgress > 20 && progressTimer) {
                    clearInterval(progressTimer);
                    progressTimer = undefined;
                  }
                }
                
                // Add estimated completion time for large imports
                if (statusData.processedNotes && noteCount && noteCount > 50) {
                  const percentComplete = statusData.processedNotes / noteCount;
                  if (percentComplete > 0.1) { // Only show estimate after 10% complete
                    const elapsedMs = Date.now() - lastProgressUpdate;
                    if (elapsedMs > 5000) { // If no updates for 5 seconds, show a message
                      setStatusLog(prev => [...prev, `Still working... ${Math.round(percentComplete * 100)}% complete`]);
                    }
                  }
                }
                
                // If import is completed, clear the polling interval and finish up
                if (statusData.completed) {
                  console.log("Import completed, stopping polling");
                  
                  // Clear all intervals
                  if (progressTimer) {
                    clearInterval(progressTimer);
                    progressTimer = undefined;
                  }
                  
                  // Set progress to 100%
                  setProgress(100);
                  setCurrentStatus("Import completed successfully!");
                  
                  // Add final success message to log
                  setStatusLog(prev => [...prev, `✓ Import completed successfully!`]);
                  
                  // Force invalidate the notes query to refresh the UI
                  queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/notes`] });
                  
                  // Clean up
                  if (statusIntervalRef.current) {
                    clearInterval(statusIntervalRef.current);
                    statusIntervalRef.current = undefined;
                  }
                  
                  // Auto close the dialog after a delay
                  setTimeout(() => {
                    onOpenChange(false);
                  }, 2000);
                  
                  // Show success toast
                  toast({
                    title: "Import successful",
                    description: `${statusData.processedNotes || noteCount} notes imported successfully`,
                    duration: 5000,
                  });
                }
              } catch (pollError) {
                console.error("Error polling import status:", pollError);
                
                // Check if we haven't had progress updates for a while
                const timeSinceLastUpdate = Date.now() - lastProgressUpdate;
                if (timeSinceLastUpdate > 15000) { // 15 seconds without updates
                  setStatusLog(prev => [...prev, `Still working... The import is taking longer than expected.`]);
                  lastProgressUpdate = Date.now(); // Reset to avoid multiple messages
                }
              }
            }, 1000); // Poll every second
          } else {
            console.warn("No import ID received from server");
            
            // Even without an import ID, show that progress is happening
            setCurrentStatus(`Processing import (no status updates available)...`);
            setStatusLog(prev => [...prev, `Import in progress - please wait...`]);
            
            // Keep the automatic progress going
            setProgress(25);
          }
          
          return importData;
        } catch (error: any) {
          // Clear all intervals
          if (progressTimer) {
            clearInterval(progressTimer);
            progressTimer = undefined;
          }
          
          if (statusIntervalRef.current) {
            clearInterval(statusIntervalRef.current);
            statusIntervalRef.current = null;
          }
          
          console.error("Error during import:", error);
          
          // Add error to the status log with error message, handling different error types
          const errorMessage = error?.message || (typeof error === 'string' ? error : 'Unknown error');
          setCurrentStatus(`Import failed: ${errorMessage}`);
          setStatusLog(prev => [...prev, `❌ Error: ${errorMessage}`]);
          
          throw error;
        }
      } else {
        throw new Error("Invalid import data format");
      }
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
        duration: 5000,
      });
      
      // Reset the file selection
      setNoteCount(null);
      
      // Close the dialog after a short delay so the user can see the success state
      setTimeout(() => {
        onOpenChange(false);
      }, 2000);
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
  
  // Display notifications for large imports
  useEffect(() => {
    if (importMutation.isPending && noteCount && noteCount > 50) {
      toast({
        title: "Large Import Detected",
        description: "This import may take a few minutes. The app will remain functional during import.",
        duration: 6000,
      });
    } else if (!importMutation.isPending && !importMutation.isSuccess) {
      // Reset progress when not pending and not successful
      setProgress(0);
    }
  }, [importMutation.isPending, importMutation.isSuccess, noteCount, toast]);
  
  // Auto-scroll the log container to the bottom whenever statusLog changes
  useEffect(() => {
    if (logContainerRef.current && statusLog.length > 0) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [statusLog]);
  
  // Clean up any intervals when the component unmounts
  useEffect(() => {
    return () => {
      if (statusIntervalRef.current) {
        clearInterval(statusIntervalRef.current);
        statusIntervalRef.current = null;
      }
    };
  }, []);
  
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
          
          {/* Enhanced progress indicator during import */}
          {((importMutation.isPending && noteCount) || (progress > 0)) && (
            <div className="pt-3">
              <div className="flex justify-between items-center mb-2 text-sm">
                <span className={progress === 100 ? "text-green-600 dark:text-green-400 font-medium" : "text-primary font-medium"}>
                  {progress === 100 
                    ? "Import completed!" 
                    : `Importing notes... ${Math.round(progress)}%`}
                </span>
                <span className="text-muted-foreground">
                  {noteCount ? `${noteCount} notes total` : ""}
                </span>
              </div>
              {/* Multi-colored progress bar with animated gradient for better visual feedback */}
              <div className="relative w-full h-3 bg-muted/30 rounded-full overflow-hidden">
                <div 
                  className={`absolute top-0 left-0 bottom-0 rounded-full transition-all duration-300 ease-out
                    ${progress === 100 
                      ? "bg-green-500" 
                      : progress > 75 
                        ? "bg-blue-500" 
                        : progress > 40 
                          ? "bg-blue-400" 
                          : "bg-gradient-to-r from-blue-300 to-blue-400 bg-[length:200%_100%] animate-gradient"}`}
                  style={{ width: `${progress}%` }}
                />
              </div>
              
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