import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: "$",
  CEDIS: "₵",
  GHS: "₵",
  EUR: "€",
  GBP: "£",
};

export function formatPrice(amount: string | number, currencyCode?: string): string {
  const numeric = typeof amount === "number" ? amount : Number.parseFloat(amount);
  const fallbackAmount = typeof amount === "string" ? amount : String(amount);

  const formattedNumber = Number.isFinite(numeric)
    ? new Intl.NumberFormat(undefined, {
        maximumFractionDigits: numeric % 1 === 0 ? 0 : 2,
      }).format(numeric)
    : fallbackAmount;

  if (!currencyCode) return formattedNumber;
  const symbol = CURRENCY_SYMBOLS[currencyCode.toUpperCase()];
  return symbol ? `${symbol}${formattedNumber}` : `${currencyCode} ${formattedNumber}`;
}

export function truncate(value: string, length: number): string {
  if (value.length <= length) return value;
  return `${value.slice(0, Math.max(length - 1, 0)).trimEnd()}…`;
}

export function buildSellerWhatsAppLink({
  listingId,
  listingTitle,
}: {
  listingId: string;
  listingTitle: string;
}): string | null {
  const raw = process.env.NEXT_PUBLIC_SELLER_WHATSAPP;
  if (!raw) return null;

  const phone = raw.replace(/[^\d]/g, "");
  if (!phone) return null;

  const message = `Hi, I'm interested in ${listingTitle} (ID: ${listingId})`;
  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}
