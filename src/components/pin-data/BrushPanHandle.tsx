'use client';

import React, { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import { GripVertical } from 'lucide-react';
import { cn } from '@/lib/utils';

interface BrushPanHandleProps {
  dataLength: number;
  startIndex: number;
  endIndex: number | undefined;
  onChange: (brushData: { startIndex?: number; endIndex?: number }) => void;
  containerMargin?: number; // Margin on left/right of chart (default 15)
  showThreshold?: number; // Show handle when span is less than this percentage (default 0.3 = 30%)
}

export function BrushPanHandle({
  dataLength,
  startIndex,
  endIndex,
  onChange,
  containerMargin = 15,
  showThreshold = 0.3,
}: BrushPanHandleProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isHovering, setIsHovering] = useState(false);
  const dragStartX = useRef<number>(0);
  const dragStartIndices = useRef<{ start: number; end: number }>({ start: 0, end: 0 });

  const actualEndIndex = endIndex ?? dataLength - 1;
  const span = actualEndIndex - startIndex;
  const spanPercentage = span / dataLength;

  // Only show handle when span is narrow
  const shouldShow = spanPercentage < showThreshold || isHovering;

  // Calculate handle position
  const handlePosition = useMemo(() => {
    const leftPercent = (startIndex / dataLength) * 100;
    const widthPercent = (span / dataLength) * 100;
    return { left: `${leftPercent}%`, width: `${widthPercent}%` };
  }, [startIndex, span, dataLength]);

  // Handle pan drag start
  const handlePanStart = useCallback((clientX: number) => {
    setIsDragging(true);
    dragStartX.current = clientX;
    dragStartIndices.current = {
      start: startIndex,
      end: actualEndIndex,
    };
  }, [startIndex, actualEndIndex]);

  // Handle pan drag move
  const handlePanMove = useCallback((e: MouseEvent | TouchEvent) => {
    if (!isDragging || !containerRef.current) return;

    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const container = containerRef.current;
    const rect = container.getBoundingClientRect();

    // Calculate usable width (accounting for margins)
    const usableWidth = rect.width - (containerMargin * 2);
    const deltaX = clientX - dragStartX.current;
    const deltaPercent = deltaX / usableWidth;
    const deltaIndex = Math.round(deltaPercent * dataLength);

    const span = dragStartIndices.current.end - dragStartIndices.current.start;
    let newStart = dragStartIndices.current.start + deltaIndex;
    let newEnd = dragStartIndices.current.end + deltaIndex;

    // Clamp to bounds while maintaining span
    if (newStart < 0) {
      newStart = 0;
      newEnd = span;
    }
    if (newEnd >= dataLength) {
      newEnd = dataLength - 1;
      newStart = Math.max(0, newEnd - span);
    }

    onChange({ startIndex: newStart, endIndex: newEnd });
  }, [isDragging, dataLength, onChange, containerMargin]);

  // Handle pan drag end
  const handlePanEnd = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Mouse event handlers
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    handlePanStart(e.clientX);
  }, [handlePanStart]);

  // Touch event handlers
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    e.stopPropagation();
    if (e.touches.length > 0) {
      handlePanStart(e.touches[0].clientX);
    }
  }, [handlePanStart]);

  // Add global event listeners when dragging
  useEffect(() => {
    if (isDragging) {
      const handleMove = (e: MouseEvent | TouchEvent) => {
        e.preventDefault();
        handlePanMove(e);
      };

      const handleUp = () => {
        handlePanEnd();
      };

      window.addEventListener('mousemove', handleMove);
      window.addEventListener('mouseup', handleUp);
      window.addEventListener('touchmove', handleMove);
      window.addEventListener('touchend', handleUp);

      return () => {
        window.removeEventListener('mousemove', handleMove);
        window.removeEventListener('mouseup', handleUp);
        window.removeEventListener('touchmove', handleMove);
        window.removeEventListener('touchend', handleUp);
      };
    }
  }, [isDragging, handlePanMove, handlePanEnd]);

  if (!shouldShow) return null;

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 pointer-events-none"
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
    >
      {/* Position handle at bottom of brush area */}
      <div
        className={cn(
          "absolute pointer-events-auto transition-opacity duration-200",
          isDragging ? "opacity-100" : isHovering ? "opacity-90" : "opacity-70"
        )}
        style={{
          bottom: '8px',
          left: handlePosition.left,
          width: handlePosition.width,
          marginLeft: `${containerMargin}px`,
          marginRight: `${containerMargin}px`,
        }}
      >
        <div className="flex justify-center items-center">
          <div
            className={cn(
              "bg-primary/70 hover:bg-primary rounded-full px-2 py-0.5 flex items-center gap-1 shadow-sm",
              "transition-all duration-150 ease-in-out",
              isDragging ? "cursor-grabbing scale-105 bg-primary shadow-md" : "cursor-grab hover:scale-105",
              "select-none"
            )}
            onMouseDown={handleMouseDown}
            onTouchStart={handleTouchStart}
            title="Drag to pan along timeline while keeping the same time span"
          >
            <GripVertical className="h-3 w-3 text-primary-foreground" />
            <span className="text-[10px] font-medium text-primary-foreground">Pan</span>
          </div>
        </div>
      </div>
    </div>
  );
}
