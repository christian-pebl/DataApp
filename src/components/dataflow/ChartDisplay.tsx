// This component's functionality has been removed.
// It previously displayed a chart.

import type { YAxisConfig } from "./ChartDisplay"; // Keep type for potential future use or if other components reference it

// Minimal placeholder or null rendering
export function ChartDisplay() {
  return null; // Or <div className="p-4 text-muted-foreground">Plot area has been removed.</div>
}

// Keep existing type exports if they are used elsewhere, otherwise they can be removed.
export type { YAxisConfig }; // Exporting the type if it's still needed by other components.

interface DataPoint {
  time: string | number;
  [key: string]: string | number | undefined | null;
}
