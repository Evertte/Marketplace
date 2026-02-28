"use client";

import Link from "next/link";
import { Home, MapPin, Mountain, Truck } from "lucide-react";

import { Badge } from "@/src/components/ui/badge";
import type { ListingCard as ListingCardType } from "@/src/lib/client/types";
import { cn, formatPrice } from "@/src/lib/utils";

const TYPE_ICONS = {
  car: Truck,
  building: Home,
  land: Mountain,
} as const;

function getMeta(listing: ListingCardType): string | null {
  if (listing.type === "car") return "Ready to inspect";
  if (listing.type === "building") return "Prime space";
  return "Land opportunity";
}

export function ListingCard({
  listing,
  className,
}: {
  listing: ListingCardType;
  className?: string;
}) {
  const Icon = TYPE_ICONS[listing.type];
  const meta = getMeta(listing);

  return (
    <Link
      href={`/listings/${listing.id}`}
      className={cn(
        "group flex h-full flex-col overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-sm transition duration-200 hover:-translate-y-1 hover:shadow-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
        className,
      )}
    >
      <div className="relative aspect-[16/10] overflow-hidden bg-slate-100">
        {listing.coverImageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={listing.coverImageUrl}
            alt={listing.title}
            className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="grid h-full place-items-center bg-gradient-to-br from-slate-100 via-slate-50 to-white text-sm text-slate-500">
            No image available
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-3 p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <Badge variant="muted" className="gap-1 rounded-full px-3 py-1 capitalize">
            <Icon className="h-3.5 w-3.5" />
            {listing.type}
          </Badge>
          <p className="text-sm font-semibold tracking-tight text-slate-900">
            {formatPrice(listing.price, listing.currency)}
          </p>
        </div>

        <div className="space-y-2">
          <h3 className="line-clamp-2 min-h-[3rem] text-base font-semibold leading-6 text-slate-900 sm:text-lg">
            {listing.title}
          </h3>
          <p className="flex items-center gap-2 text-sm text-slate-500">
            <MapPin className="h-4 w-4 shrink-0" />
            <span className="line-clamp-1">
              {listing.locationCity}, {listing.locationRegion}, {listing.locationCountry}
            </span>
          </p>
        </div>

        {meta ? (
          <div className="mt-auto border-t border-slate-100 pt-3 text-xs font-medium uppercase tracking-[0.18em] text-slate-400">
            {meta}
          </div>
        ) : null}
      </div>
    </Link>
  );
}
