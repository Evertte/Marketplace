import Link from "next/link";
import { ArrowRight, Building2, CarFront, Trees } from "lucide-react";

const TILES = [
  {
    title: "Cars",
    description: "Daily driver deals, work trucks, and premium vehicles ready to inspect.",
    href: "/browse?type=car",
    icon: CarFront,
  },
  {
    title: "Buildings",
    description: "Residential and commercial spaces listed by trusted marketplace sellers.",
    href: "/browse?type=building",
    icon: Building2,
  },
  {
    title: "Lands",
    description: "Plots, acreage, and development opportunities across key regions.",
    href: "/browse?type=land",
    icon: Trees,
  },
] as const;

export function CategoryTiles() {
  return (
    <section className="grid gap-4 md:grid-cols-3">
      {TILES.map((tile) => {
        const Icon = tile.icon;
        return (
          <Link
            key={tile.title}
            href={tile.href}
            className="group rounded-[1.75rem] border border-white/80 bg-[linear-gradient(180deg,_rgba(255,255,255,0.96),_rgba(248,250,252,0.92))] p-6 shadow-[0_18px_40px_-28px_rgba(15,23,42,0.28)] backdrop-blur-sm transition duration-200 hover:-translate-y-1 hover:shadow-[0_24px_50px_-28px_rgba(15,23,42,0.28)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="grid h-12 w-12 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-md shadow-primary/20">
                <Icon className="h-5 w-5" />
              </div>
              <ArrowRight className="h-5 w-5 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-slate-700" />
            </div>
            <div className="mt-6 space-y-2">
              <h2 className="text-xl font-semibold tracking-tight text-slate-950">{tile.title}</h2>
              <p className="text-sm leading-6 text-slate-600">{tile.description}</p>
            </div>
            <div className="mt-6 text-sm font-semibold text-slate-950">Browse {tile.title}</div>
          </Link>
        );
      })}
    </section>
  );
}
