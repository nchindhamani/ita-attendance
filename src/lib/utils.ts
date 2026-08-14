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
        .map((part) => {
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

/**
 * Basic email format check. Accepts school emails (including +aliases)
 * and common providers (Gmail, Yahoo, etc.).
 * Examples:
 * - karthic.subramanian@catamilacademy.org
 * - adhinarayanan.narasimman+hscp2@catamilacademy.org
 * - name@gmail.com
 */
export function isValidEmail(email: string): boolean {
  if (!email || !email.trim()) return false;
  return /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(email.trim());
}

const HSCP_SECTIONS = ["Reading", "Writing", "Conversation"] as const;

/**
 * Teacher section rules (admin + HSCP officer create):
 * - HSCP grades: Reading, Writing, or Conversation
 * - Regular grades: a single letter A–Z
 * Returns normalized section or an error message.
 */
export function validateTeacherSection(
  grade: string,
  section: string
): { ok: true; section: string } | { ok: false; error: string } {
  const raw = (section || "").trim();
  if (!raw) {
    return { ok: false, error: "Section is required for teachers." };
  }
  const gradeUpper = (grade || "").trim().toUpperCase();
  const isHscp = gradeUpper.startsWith("HSCP");
  if (isHscp) {
    const match = HSCP_SECTIONS.find((s) => s.toLowerCase() === raw.toLowerCase());
    if (!match) {
      return {
        ok: false,
        error: "For HSCP teachers, section must be Reading, Writing, or Conversation.",
      };
    }
    return { ok: true, section: match };
  }
  if (!/^[A-Za-z]$/.test(raw)) {
    return {
      ok: false,
      error: "For regular teachers, section must be a single letter (A–Z).",
    };
  }
  return { ok: true, section: raw.toUpperCase() };
}

