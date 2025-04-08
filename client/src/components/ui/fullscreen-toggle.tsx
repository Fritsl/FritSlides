import React, { useState, useEffect } from 'react';
import { Maximize2, Minimize2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

// Global state to track CSS fullscreen mode
const globalState = {
  isFullscreenMode: false,
  listeners: new Set<(isFullscreen: boolean) => void>()
};

// Function to notify all listeners of state change
function notifyFullscreenChange(isFullscreen: boolean) {
  globalState.isFullscreenMode = isFullscreen;
  globalState.listeners.forEach(listener => listener(isFullscreen));
}

// Apply CSS fullscreen to the app container
function applyCSSFullscreen(isFullscreen: boolean) {
  const appElement = document.querySelector('#root') || document.body;
  
  if (isFullscreen) {
    // Save current scroll position
    const scrollY = window.scrollY;
    
    // Apply fullscreen styles
    document.body.style.overflow = 'hidden';
    appElement.classList.add('css-fullscreen-mode');
    
    // Create and append the fullscreen overlay if it doesn't exist
    let overlay = document.getElementById('css-fullscreen-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'css-fullscreen-overlay';
      overlay.style.position = 'fixed';
      overlay.style.top = '0';
      overlay.style.left = '0';
      overlay.style.width = '100vw';
      overlay.style.height = '100vh';
      overlay.style.backgroundColor = '#000';
      overlay.style.zIndex = '9998';
      overlay.style.display = 'flex';
      overlay.style.alignItems = 'center';
      overlay.style.justifyContent = 'center';
      document.body.appendChild(overlay);

      // Move the app element into the overlay as a direct child
      const appClone = appElement.cloneNode(true) as HTMLElement;
      appClone.id = 'css-fullscreen-content';
      appClone.style.width = '100%';
      appClone.style.height = '100%';
      appClone.style.overflow = 'auto';
      appClone.style.position = 'relative';
      appClone.style.zIndex = '9999';
      
      // Hide the original
      if (appElement instanceof HTMLElement) {
        appElement.style.visibility = 'hidden';
      }
      
      // Add the clone to the overlay
      overlay.appendChild(appClone);
      
      // Restore scroll position
      setTimeout(() => {
        window.scrollTo(0, scrollY);
      }, 0);
    }
  } else {
    // Remove fullscreen styles
    document.body.style.overflow = '';
    appElement.classList.remove('css-fullscreen-mode');
    
    // Remove the overlay
    const overlay = document.getElementById('css-fullscreen-overlay');
    if (overlay) {
      document.body.removeChild(overlay);
    }
    
    // Make the original visible again
    if (appElement instanceof HTMLElement) {
      appElement.style.visibility = 'visible';
    }
  }
}

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
  const [isFullscreen, setIsFullscreen] = useState(globalState.isFullscreenMode);

  // Register this component as a listener for fullscreen state changes
  useEffect(() => {
    const listener = (isFullscreenMode: boolean) => {
      setIsFullscreen(isFullscreenMode);
    };
    
    globalState.listeners.add(listener);
    
    return () => {
      globalState.listeners.delete(listener);
    };
  }, []);

  // Keyboard shortcut for toggling fullscreen
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'f' || e.key === 'F') {
        toggleFullscreen();
      } else if (e.key === 'Escape' && isFullscreen) {
        toggleFullscreen();
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isFullscreen]);

  const toggleFullscreen = () => {
    try {
      // Toggle the fullscreen mode using our CSS approach
      const newState = !isFullscreen;
      applyCSSFullscreen(newState);
      notifyFullscreenChange(newState);
    } catch (err) {
      console.error('Error toggling CSS fullscreen:', err);
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