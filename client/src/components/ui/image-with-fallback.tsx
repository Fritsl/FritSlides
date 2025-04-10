import React, { useState, useEffect } from 'react';
import { ImageIcon, Loader2 } from 'lucide-react';

interface ImageWithFallbackProps {
  src: string;
  alt: string;
  className?: string;
  loadingTimeout?: number; // in milliseconds
  onClick?: () => void;
}

export function ImageWithFallback({
  src,
  alt,
  className = '',
  loadingTimeout = 30000, // 30 seconds default (5x longer than before)
  onClick,
  ...props
}: ImageWithFallbackProps & React.ImgHTMLAttributes<HTMLImageElement>) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    // Reset states when src changes
    setLoading(true);
    setError(false);
    setTimedOut(false);

    // Set a longer timeout for image loading
    const timeoutId = setTimeout(() => {
      if (loading) {
        setTimedOut(true);
      }
    }, loadingTimeout);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [src, loadingTimeout, loading]);

  // Handle successful load
  const handleLoad = () => {
    setLoading(false);
  };

  // Handle loading error
  const handleError = () => {
    setLoading(false);
    setError(true);
  };

  return (
    <>
      {(loading && !timedOut) && (
        <div className="flex flex-col items-center justify-center h-full w-full">
          <Loader2 className="h-8 w-8 animate-spin mb-2" />
          <span className="text-sm text-gray-400">Loading image...</span>
        </div>
      )}
      
      {timedOut && !error && (
        <div className="flex flex-col items-center justify-center h-full w-full">
          <div className="relative">
            {/* Still try to load the image in the background */}
            <img
              src={src}
              alt={alt}
              className="opacity-0 absolute"
              onLoad={handleLoad}
              onError={handleError}
            />
            <div className="flex flex-col items-center justify-center p-4">
              <ImageIcon className="h-10 w-10 mb-2 text-gray-400" />
              <span className="text-sm text-gray-400">
                Still loading image...
              </span>
              <span className="text-xs text-gray-500 mt-1">{alt}</span>
            </div>
          </div>
        </div>
      )}
      
      {error && (
        <div className="flex flex-col items-center justify-center h-full w-full">
          <ImageIcon className="h-10 w-10 mb-2 text-gray-400" />
          <span className="text-sm text-gray-400">{alt}</span>
        </div>
      )}
      
      <img
        src={src}
        alt={alt}
        className={`${className} ${loading ? 'hidden' : ''} ${error ? 'hidden' : ''}`}
        onLoad={handleLoad}
        onError={handleError}
        onClick={onClick}
        {...props}
      />
    </>
  );
}