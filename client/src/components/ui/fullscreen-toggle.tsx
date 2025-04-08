import React, { useState, useEffect } from 'react';
import { Maximize2, Minimize2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import screenfull from 'screenfull';

// Global state to track fullscreen mode across components
const globalState = {
  isFullscreenMode: false,
  listeners: new Set<(isFullscreen: boolean) => void>()
};

// Function to notify all listeners of fullscreen state change
function notifyFullscreenChange(isFullscreen: boolean) {
  globalState.isFullscreenMode = isFullscreen;
  globalState.listeners.forEach(listener => listener(isFullscreen));
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

  // Initialize fullscreen state and set up change listener
  useEffect(() => {
    // Check initial state
    const updateFullscreenState = () => {
      const fullscreenActive = screenfull.isEnabled && screenfull.isFullscreen;
      setIsFullscreen(fullscreenActive);
      notifyFullscreenChange(fullscreenActive);
    };

    // Register for screenfull change events
    if (screenfull.isEnabled) {
      screenfull.on('change', updateFullscreenState);
    }

    // Register this component as a listener for our global state
    const listener = (isFullscreenMode: boolean) => {
      setIsFullscreen(isFullscreenMode);
    };
    
    globalState.listeners.add(listener);
    
    return () => {
      if (screenfull.isEnabled) {
        screenfull.off('change', updateFullscreenState);
      }
      globalState.listeners.delete(listener);
    };
  }, []);

  // Keyboard shortcut for toggling fullscreen
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only process if not in a form field
      const activeElement = document.activeElement;
      const isFormField = activeElement instanceof HTMLInputElement || 
                          activeElement instanceof HTMLTextAreaElement ||
                          activeElement instanceof HTMLSelectElement;
      
      if (isFormField) return;
      
      if (e.key === 'f' || e.key === 'F') {
        e.preventDefault();
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
      // In Replit's environment, we'll always use the CSS fallback
      // This prevents console errors from rejected fullscreen requests
      fallbackToCSS(!isFullscreen);
      
      /* 
      // This code is left commented out for reference but not used to avoid errors
      // A production environment outside Replit could use this implementation
      if (screenfull.isEnabled) {
        if (!screenfull.isFullscreen) {
          // Enter fullscreen
          screenfull.request().then(() => {
            notifyFullscreenChange(true);
          }).catch(() => {
            // Silently fall back to CSS mode if browser fullscreen fails
            fallbackToCSS(true);
          });
        } else {
          // Exit fullscreen
          screenfull.exit().then(() => {
            notifyFullscreenChange(false);
          }).catch(() => {
            // Silently fall back to CSS mode if browser fullscreen fails
            fallbackToCSS(false);
          });
        }
      } else {
        // Screenfull is not enabled, use CSS fallback
        fallbackToCSS(!isFullscreen);
      }
      */
    } catch (err) {
      // Silently fall back to CSS mode if there's an error
      fallbackToCSS(!isFullscreen);
    }
  };
  
  // CSS-based fullscreen as a fallback
  const fallbackToCSS = (enterFullscreen: boolean) => {
    const appElement = document.querySelector('#root') || document.body;
    
    if (enterFullscreen) {
      // Apply fullscreen styles
      document.body.style.overflow = 'hidden';
      if (appElement instanceof HTMLElement) {
        appElement.style.position = 'fixed';
        appElement.style.top = '0';
        appElement.style.left = '0';
        appElement.style.width = '100vw';
        appElement.style.height = '100vh';
        appElement.style.zIndex = '9999';
        appElement.style.background = '#000';
      }
      
      // Update state
      notifyFullscreenChange(true);
    } else {
      // Remove fullscreen styles
      document.body.style.overflow = '';
      if (appElement instanceof HTMLElement) {
        appElement.style.position = '';
        appElement.style.top = '';
        appElement.style.left = '';
        appElement.style.width = '';
        appElement.style.height = '';
        appElement.style.zIndex = '';
        appElement.style.background = '';
      }
      
      // Update state
      notifyFullscreenChange(false);
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