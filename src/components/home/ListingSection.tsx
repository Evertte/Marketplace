import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { ListingCard } from "@/src/components/listings/ListingCard";
import { Button, buttonVariants } from "@/src/components/ui/button";
import { Skeleton } from "@/src/components/ui/skeleton";
import type { ListingCard as ListingCardType, ListingType } from "@/src/lib/client/types";
import { cn } from "@/src/lib/utils";

export function ListingSection({
  type,
  title,
  subtitle,
  items,
  loading,
}: {
  type: ListingType;
  title: string;
  subtitle: string;
  items: ListingCardType[];
  loading: boolean;
}) {
  return (
    <section className="space-y-5">
      <div className="flex items-end justify-between gap-4">
        <div className="space-y-1">
          <h2 className="text-2xl font-semibold tracking-tight text-slate-950">{title}</h2>
          <p className="text-sm text-slate-500">{subtitle}</p>
        </div>
        <Link href={`/browse?type=${type}`} className={cn(buttonVariants({ variant: "outline", size: "sm" }), "rounded-full px-4") }>
          View all
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="aspect-[16/10] rounded-[1.75rem]" />
          ))}
        </div>
      ) : items.length > 0 ? (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
          {items.map((item) => (
            <ListingCard key={item.id} listing={item} />
          ))}
        </div>
      ) : (
        <div className="rounded-[1.75rem] border border-dashed border-slate-300 bg-white px-6 py-10 text-center text-sm text-slate-500">
          No published {title.toLowerCase()} listings yet.
        </div>
      )}
    </section>
  );
}
