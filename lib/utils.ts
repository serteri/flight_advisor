import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs))
}

export function normalizeSource(source: unknown): string {
    return String(source || "duffel").toLowerCase();
}
