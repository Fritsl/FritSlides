import React, { useState, useEffect } from 'react';
import { Maximize2, Minimize2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface FullscreenToggleProps {
  className?: string;
  iconClassName?: string;
  buttonClassName?: string;
  showTooltip?: boolean;
}

export function FullscreenToggle({
  className = '',
  iconClassName = 'w-4 h-4',
  buttonClassName = '',
  showTooltip = true
}: FullscreenToggleProps) {
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Update fullscreen state when it changes outside this component
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(Boolean(
        document.fullscreenElement ||
        (document as any).webkitFullscreenElement ||
        (document as any).mozFullScreenElement ||
        (document as any).msFullscreenElement
      ));
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('mozfullscreenchange', handleFullscreenChange);
    document.addEventListener('MSFullscreenChange', handleFullscreenChange);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.removeEventListener('mozfullscreenchange', handleFullscreenChange);
      document.removeEventListener('MSFullscreenChange', handleFullscreenChange);
    };
  }, []);

  const toggleFullscreen = async () => {
    try {
      if (!isFullscreen) {
        // Enter fullscreen
        const element = document.documentElement;
        if (element.requestFullscreen) {
          await element.requestFullscreen();
        } else if ((element as any).webkitRequestFullscreen) {
          await (element as any).webkitRequestFullscreen();
        } else if ((element as any).mozRequestFullScreen) {
          await (element as any).mozRequestFullScreen();
        } else if ((element as any).msRequestFullscreen) {
          await (element as any).msRequestFullscreen();
        }
      } else {
        // Exit fullscreen
        if (document.exitFullscreen) {
          await document.exitFullscreen();
        } else if ((document as any).webkitExitFullscreen) {
          await (document as any).webkitExitFullscreen();
        } else if ((document as any).mozCancelFullScreen) {
          await (document as any).mozCancelFullScreen();
        } else if ((document as any).msExitFullscreen) {
          await (document as any).msExitFullscreen();
        }
      }
    } catch (err) {
      console.error('Error toggling fullscreen:', err);
    }
  };

  return (
    <div className={`${className}`}>
      <Button
        variant="ghost"
        size="sm"
        className={`p-1 hover:bg-slate-800/40 transition-all ${buttonClassName}`}
        onClick={toggleFullscreen}
        title={isFullscreen ? "Exit Fullscreen (ESC)" : "Enter Fullscreen (F)"}
      >
        {isFullscreen ? (
          <Minimize2 className={iconClassName} />
        ) : (
          <Maximize2 className={iconClassName} />
        )}
        {showTooltip && (
          <span className="sr-only">{isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}</span>
        )}
      </Button>
    </div>
  );
}