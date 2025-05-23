
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { parseISO } from 'date-fns';


export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Helper function for robust date string validation (YYYY-MM-DD format)
export const isValidDateString = (val: string): boolean => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(val)) {
    return false; // Basic format check
  }
  try {
    const date = parseISO(val);
    // Check if parsing results in a valid date and the original string is not just 'Invalid Date' or similar
    // Also ensure the date parts match to avoid parseISO being too lenient with partial matches
    return !isNaN(date.valueOf()) && date.toISOString().startsWith(val);
  } catch (e) {
    return false;
  }
};
