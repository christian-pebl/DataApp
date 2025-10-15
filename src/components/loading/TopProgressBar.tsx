'use client';

import React, { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

interface TopProgressBarProps {
  isLoading: boolean;
  progress: number;
  className?: string;
}

export function TopProgressBar({ isLoading, progress, className }: TopProgressBarProps) {
  const [visible, setVisible] = useState(false);
  const [currentProgress, setCurrentProgress] = useState(0);

  useEffect(() => {
    if (isLoading) {
      setVisible(true);
      setCurrentProgress(progress);
    } else {
      // Complete the progress bar
      setCurrentProgress(100);
      // Then fade out after 300ms
      const timer = setTimeout(() => {
        setVisible(false);
        setCurrentProgress(0);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [isLoading, progress]);

  if (!visible) return null;

  return (
    <div
      className={cn(
        "fixed top-0 left-0 right-0 z-50 h-1 bg-muted/30",
        "transition-opacity duration-300",
        !isLoading && "opacity-0",
        className
      )}
    >
      <div
        className={cn(
          "h-full progress-bar",
          currentProgress === 100 ? "bg-green-500" : "bg-primary"
        )}
        style={{ width: `${currentProgress}%` }}
      />
    </div>
  );
}
