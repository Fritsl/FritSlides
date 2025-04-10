import React, { useState } from 'react';
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

  // Handle loading error
  const handleError = () => {
    console.log(`Image failed to load: ${src}`);
    setError(true);
  };

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full w-full">
        <ImageIcon className="h-10 w-10 mb-2 text-gray-400" />
        <span className="text-sm text-gray-400">{alt}</span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      className={className}
      onError={handleError}
      onClick={onClick}
      {...props}
    />
  );
}