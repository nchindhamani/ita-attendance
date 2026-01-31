import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Capitalizes the first letter of each word in a name.
 * Handles multiple words, apostrophes, and hyphens.
 * Examples:
 * - "john doe" -> "John Doe"
 * - "MARY JANE SMITH" -> "Mary Jane Smith"
 * - "o'brien" -> "O'Brien"
 * - "van der berg" -> "Van Der Berg"
 * - "mary-jane" -> "Mary-Jane"
 */
export function capitalizeName(name: string): string {
  if (!name || !name.trim()) {
    return name;
  }

  return name
    .trim()
    .split(/\s+/)
    .map((word) => {
      // Handle words with apostrophes or hyphens
      return word
        .split(/(['-])/)
        .map((part, index) => {
          // Skip separators (apostrophes and hyphens)
          if (part === "'" || part === "-") {
            return part;
          }
          // Capitalize first letter, lowercase the rest
          return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
        })
        .join("");
    })
    .join(" ");
}

