/**
 * CSV Date Injector
 *
 * Adds a date column to CSV files that don't have time data
 */

/**
 * Check if a CSV file has a time/date column
 *
 * @param file - The CSV File object to check
 * @returns true if a time column is detected, false otherwise
 */
export async function hasTimeColumn(file: File): Promise<boolean> {
  try {
    const content = await file.text();
    const lines = content.split('\n');

    if (lines.length === 0) return false;

    // Get header row
    const header = lines[0].toLowerCase();

    // Check for common time/date column names
    const timeKeywords = ['time', 'date', 'datetime', 'timestamp', 'day', 'month', 'year'];

    for (const keyword of timeKeywords) {
      if (header.includes(keyword)) {
        console.log('[CSV-DATE-INJECTOR] Time column detected:', keyword);
        return true;
      }
    }

    console.log('[CSV-DATE-INJECTOR] No time column detected in header:', header.substring(0, 200));
    return false;
  } catch (error) {
    console.error('[CSV-DATE-INJECTOR] Error checking for time column:', error);
    return false; // Assume no time column on error
  }
}

/**
 * Parse CSV into rows, properly handling quoted fields with newlines
 *
 * @param csvContent - Raw CSV content
 * @returns Array of row strings
 */
function parseCSVRows(csvContent: string): string[] {
  const rows: string[] = [];
  let currentRow = '';
  let insideQuotes = false;

  for (let i = 0; i < csvContent.length; i++) {
    const char = csvContent[i];
    const nextChar = csvContent[i + 1];

    if (char === '"') {
      // Check for escaped quotes ("")
      if (nextChar === '"') {
        currentRow += '""';
        i++; // Skip next quote
      } else {
        // Toggle quote state
        insideQuotes = !insideQuotes;
        currentRow += char;
      }
    } else if (char === '\n' && !insideQuotes) {
      // End of row (only if not inside quotes)
      if (currentRow.trim().length > 0) {
        rows.push(currentRow);
      }
      currentRow = '';
    } else if (char === '\r') {
      // Skip carriage return (handle Windows line endings)
      if (nextChar === '\n') {
        // Will be handled on next iteration
        continue;
      } else if (!insideQuotes) {
        // Mac-style line ending
        if (currentRow.trim().length > 0) {
          rows.push(currentRow);
        }
        currentRow = '';
      } else {
        currentRow += char;
      }
    } else {
      currentRow += char;
    }
  }

  // Add final row if not empty
  if (currentRow.trim().length > 0) {
    rows.push(currentRow);
  }

  return rows;
}

/**
 * Inject a date column as the first column in a CSV file
 *
 * @param csvContent - The original CSV content as a string
 * @param date - The date to inject (format: DD/MM/YYYY)
 * @returns Modified CSV content with date column added
 */
export function injectDateColumn(csvContent: string, date: string): string {
  try {
    console.log('[CSV-DATE-INJECTOR] Injecting date:', date);
    console.log('[CSV-DATE-INJECTOR] Original CSV length:', csvContent.length);

    // Parse CSV into rows, properly handling quoted fields with newlines
    const rows = parseCSVRows(csvContent);

    if (rows.length === 0) {
      throw new Error('CSV file is empty');
    }

    console.log('[CSV-DATE-INJECTOR] Total rows:', rows.length);

    // Process header row
    const headerRow = rows[0];
    const modifiedHeader = `Date,${headerRow}`;

    console.log('[CSV-DATE-INJECTOR] Original header:', headerRow.substring(0, 300));
    console.log('[CSV-DATE-INJECTOR] Modified header:', modifiedHeader.substring(0, 300));

    // Process data rows
    const modifiedRows = [modifiedHeader];

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      // Add the date as the first value
      const modifiedRow = `${date},${row}`;
      modifiedRows.push(modifiedRow);
    }

    const result = modifiedRows.join('\n');

    console.log('[CSV-DATE-INJECTOR] Modified CSV length:', result.length);
    console.log('[CSV-DATE-INJECTOR] Sample first data row:', modifiedRows[1]?.substring(0, 200));

    return result;
  } catch (error) {
    console.error('[CSV-DATE-INJECTOR] Error injecting date column:', error);
    throw error;
  }
}

/**
 * Create a new File object with date column injected
 *
 * @param originalFile - The original CSV File object
 * @param date - The date to inject (format: DD/MM/YYYY)
 * @returns New File object with date column added
 */
export async function createFileWithDateColumn(
  originalFile: File,
  date: string
): Promise<File> {
  try {
    // Read the original file content
    const content = await originalFile.text();

    // Inject the date column
    const modifiedContent = injectDateColumn(content, date);

    // Create a new File object
    const modifiedFile = new File(
      [modifiedContent],
      originalFile.name,
      { type: originalFile.type }
    );

    console.log('[CSV-DATE-INJECTOR] Created modified file:', {
      name: modifiedFile.name,
      size: modifiedFile.size,
      originalSize: originalFile.size
    });

    return modifiedFile;
  } catch (error) {
    console.error('[CSV-DATE-INJECTOR] Error creating file with date column:', error);
    throw error;
  }
}
