/**
 * Simple utility to swap day and month in ISO timestamps
 * Input: "2025-01-05T00:23:00.000Z" (January 5th)
 * Output: "2025-05-01T00:23:00.000Z" (May 1st)
 */
export function swapDayAndMonth(isoTimestamp: string): string {
  try {
    // Parse ISO timestamp: YYYY-MM-DDTHH:MM:SS.SSSZ
    const match = isoTimestamp.match(/^(\d{4})-(\d{2})-(\d{2})T(.+)$/);
    if (!match) {
      console.error('[SWAP] Invalid ISO timestamp:', isoTimestamp);
      return isoTimestamp;
    }

    const [, year, month, day, timepart] = match;
    
    // Swap month and day
    const swapped = `${year}-${day}-${month}T${timepart}`;
    
    console.log(`[SWAP] ${isoTimestamp} → ${swapped}`);
    return swapped;
  } catch (error) {
    console.error('[SWAP] Error swapping dates:', error);
    return isoTimestamp;
  }
}

/**
 * Swap day and month for all timestamps in an array of data points
 */
export function swapDatesInData(data: any[]): any[] {
  return data.map(point => ({
    ...point,
    time: swapDayAndMonth(point.time)
  }));
}
