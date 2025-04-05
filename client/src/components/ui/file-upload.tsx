import { useState, useRef } from 'react';
import { Button } from "@/components/ui/button";
import { ImageIcon, X, Loader2 } from "lucide-react";

interface FileUploadProps {
  onUpload: (file: File) => Promise<{ imageUrl: string }>;
  onRemove?: (url: string) => void;
  existingImages?: string[];
  maxFiles?: number;
}

export function FileUpload({ 
  onUpload, 
  onRemove,
  existingImages = [],
  maxFiles = 5
}: FileUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadedImages, setUploadedImages] = useState<string[]>(existingImages);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    
    // Check if we're exceeding max files
    if (uploadedImages.length + files.length > maxFiles) {
      alert(`You can only upload a maximum of ${maxFiles} images`);
      return;
    }
    
    setIsUploading(true);
    
    try {
      // Upload each file
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const result = await onUpload(file);
        setUploadedImages(prev => [...prev, result.imageUrl]);
      }
    } catch (error) {
      console.error('Upload failed:', error);
    } finally {
      setIsUploading(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleRemove = (url: string) => {
    setUploadedImages(prev => prev.filter(img => img !== url));
    if (onRemove) {
      onRemove(url);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 flex-wrap">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading || uploadedImages.length >= maxFiles}
          className={`border border-dashed ${isUploading ? 'opacity-50' : ''}`}
        >
          {isUploading ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Uploading...
            </>
          ) : (
            <>
              <ImageIcon className="h-4 w-4 mr-2" />
              Add Image
            </>
          )}
        </Button>
        
        {uploadedImages.map((url, index) => (
          <div key={index} className="relative group">
            <img
              src={url}
              alt={`Uploaded ${index + 1}`}
              className="h-10 w-10 object-cover rounded border"
            />
            <button
              type="button"
              className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={() => handleRemove(url)}
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        ))}
      </div>
      
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleUpload}
        className="hidden"
        accept="image/*"
        multiple={maxFiles > 1}
      />
      
      {uploadedImages.length > 0 && (
        <p className="text-xs text-muted-foreground">
          {uploadedImages.length} of {maxFiles} images
        </p>
      )}
    </div>
  );
}
