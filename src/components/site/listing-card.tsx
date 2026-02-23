"use client";

import Link from "next/link";
import { MapPin } from "lucide-react";

import { Badge } from "@/src/components/ui/badge";
import { Card, CardContent } from "@/src/components/ui/card";
import type { ListingCard as ListingCardType } from "@/src/lib/client/types";

export function ListingCard({ listing }: { listing: ListingCardType }) {
  return (
    <Link href={`/listings/${listing.id}`} className="block">
      <Card className="h-full overflow-hidden transition hover:-translate-y-0.5 hover:shadow-lg">
        <div className="aspect-[4/3] bg-muted">
          {listing.coverImageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={listing.coverImageUrl}
              alt={listing.title}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="grid h-full place-items-center text-sm text-muted-foreground">
              No image
            </div>
          )}
        </div>
        <CardContent className="p-4">
          <div className="mb-2 flex items-center justify-between gap-2">
            <Badge variant="muted">{listing.type}</Badge>
            <p className="text-sm font-semibold">
              {listing.currency} {listing.price}
            </p>
          </div>
          <h3 className="line-clamp-2 min-h-[2.6rem] font-medium">{listing.title}</h3>
          <p className="mt-2 flex items-center gap-1 text-sm text-muted-foreground">
            <MapPin className="h-4 w-4" />
            <span className="line-clamp-1">
              {listing.locationCity}, {listing.locationRegion}, {listing.locationCountry}
            </span>
          </p>
        </CardContent>
      </Card>
    </Link>
  );
}

