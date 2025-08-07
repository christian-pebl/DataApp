
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { parseISO, isValid } from 'date-fns'; // Ensure isValid is imported


export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Helper function for robust date string validation (YYYY-MM-DD format)
export const isValidDateString = (val: string | undefined | null): boolean => {
  if (!val || !/^\d{4}-\d{2}-\d{2}$/.test(val)) {
    return false; // Basic format check and ensure val is not undefined/null
  }
  try {
    const date = parseISO(val);
    // Check if parsing results in a valid date
    if (!isValid(date)) {
      return false;
    }
    
    // Verify the date components match what was parsed to avoid invalid dates like 2025-02-30
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const reconstructed = `${year}-${month}-${day}`;
    
    return reconstructed === val;
  } catch (e) {
    return false;
  }
};
