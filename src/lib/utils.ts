import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatSlugToTitle(slug: string) {
  if (!slug) return "Unknown Event";

  // 1. Replace hyphens with spaces
  const text = slug.replace(/-/g, " ");

  // 2. Title Case: Capitalize the first letter of every word
  return text.replace(/\b\w/g, (char) => char.toUpperCase());
}