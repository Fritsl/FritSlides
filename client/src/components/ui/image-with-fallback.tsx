import React, { useState, useEffect, useRef } from 'react';
import { ImageIcon } from 'lucide-react';

interface ImageWithFallbackProps {
  src: string;
  alt: string;
  className?: string;
  onClick?: () => void;
}

export function ImageWithFallback({
  src,
  alt,
  className = '',
  onClick,
  ...props
}: ImageWithFallbackProps & React.ImgHTMLAttributes<HTMLImageElement>) {
  const [error, setError] = useState(false);
  const [isTransparentImage, setIsTransparentImage] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  // Handle loading error
  const handleError = () => {
    console.log(`Image failed to load: ${src}`);
    setError(true);
  };

  // Check if the image is a transparent placeholder (1x1 px)
  useEffect(() => {
    const checkImageSize = () => {
      if (imgRef.current && imgRef.current.complete) {
        // Consider the image "missing" if it's 1x1 pixels (our transparent placeholder)
        const isTinyPlaceholder = imgRef.current.naturalWidth <= 1 && imgRef.current.naturalHeight <= 1;
        setIsTransparentImage(isTinyPlaceholder);
      }
    };

    // Add event listener for when image loads
    const img = imgRef.current;
    if (img) {
      if (img.complete) {
        checkImageSize();
      } else {
        img.addEventListener('load', checkImageSize);
      }
    }

    return () => {
      if (img) {
        img.removeEventListener('load', checkImageSize);
      }
    };
  }, [src]);

  // Show fallback for both error cases and transparent placeholders
  if (error || isTransparentImage) {
    return (
      <div className="flex flex-col items-center justify-center h-full w-full">
        <ImageIcon className="h-10 w-10 mb-2 text-gray-400" />
        <span className="text-sm text-gray-400">{alt}</span>
      </div>
    );
  }

  return (
    <img
      ref={imgRef}
      src={src}
      alt={alt}
      className={className}
      onError={handleError}
      onClick={onClick}
      {...props}
    />
  );
}