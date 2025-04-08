import React, { useState, useEffect } from 'react';
import { Maximize2, Minimize2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
// Import is retained for type checking but we won't use it directly
// to avoid browser API errors in Replit environment
import screenfull from 'screenfull';

// Global state for CSS-based fullscreen mode
const cssFullscreenState = {
  isFullscreenMode: false,
  listeners: new Set<(isFullscreen: boolean) => void>()
};

// Function to notify all listeners of fullscreen state change
function notifyFullscreenChange(isFullscreen: boolean) {
  cssFullscreenState.isFullscreenMode = isFullscreen;
  cssFullscreenState.listeners.forEach(listener => listener(isFullscreen));
}

// Simple CSS-only fullscreen implementation for Replit environment
function toggleCSSFullscreen(enterFullscreen: boolean) {
  try {
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
  } catch (err) {
    // Silent error handling
    console.warn("CSS fullscreen toggle error:", err);
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
  const [isFullscreen, setIsFullscreen] = useState(cssFullscreenState.isFullscreenMode);

  // Register component with central state
  useEffect(() => {
    const listener = (isFullscreenMode: boolean) => {
      setIsFullscreen(isFullscreenMode);
    };
    
    cssFullscreenState.listeners.add(listener);
    
    return () => {
      cssFullscreenState.listeners.delete(listener);
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
        toggleCSSFullscreen(!isFullscreen);
      } else if (e.key === 'Escape' && isFullscreen) {
        e.preventDefault();
        toggleCSSFullscreen(false);
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isFullscreen]);

  return (
    <div className={`${className}`}>
      <Button
        variant="ghost"
        size="sm"
        className={`p-1 hover:bg-slate-800/40 transition-all ${buttonClassName}`}
        onClick={() => toggleCSSFullscreen(!isFullscreen)}
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