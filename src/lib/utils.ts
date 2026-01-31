import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export const VALID_SUBSPECIALTIES = [
  "FOOT_AND_ANKLE",
  "HAND",
  "HIP_AND_KNEE",
  "SHOULDER_AND_ELBOW",
  "SPINE",
  "SPORTS_MEDICINE",
  "TRAUMA",
  "ONCOLOGY",
  "PEDIATRICS",
  "GENERAL",
  "TEXTBOOKS",
  "PRESENTATIONS",
  "RESEARCH",
  "OITE",
];

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export function formatSubspecialty(subspecialty: string): string {
  return subspecialty
    .replace(/_/g, " ")
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

export function slugifySubspecialty(subspecialty: string): string {
  return subspecialty.toLowerCase().replace(/_/g, "-");
}

export function unslugifySubspecialty(slug: string): string {
  return slug.toUpperCase().replace(/-/g, "_");
}
