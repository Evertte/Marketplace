import Link from "next/link";

const FOOTER_COLUMNS = [
  {
    title: "Marketplace",
    links: [
      { href: "/", label: "Home" },
      { href: "/browse", label: "Browse Listings" },
      { href: "/messages", label: "Messages" },
    ],
  },
  {
    title: "Browse",
    links: [
      { href: "/browse?type=car", label: "Cars" },
      { href: "/browse?type=building", label: "Buildings" },
      { href: "/browse?type=land", label: "Lands" },
    ],
  },
  {
    title: "Support",
    links: [
      { href: "/messages", label: "Contact Support" },
      { href: "/admin/reports", label: "Report Abuse" },
      { href: "/login", label: "Sign In" },
    ],
  },
  {
    title: "Legal",
    links: [
      { href: "#", label: "Privacy Policy" },
      { href: "#", label: "Terms of Service" },
      { href: "#", label: "Safety Tips" },
    ],
  },
] as const;

export function Footer() {
  return (
    <footer className="mt-20 border-t border-primary/20 bg-primary text-primary-foreground">
      <div className="mx-auto max-w-7xl px-4 py-14 md:px-6">
        <div className="grid gap-10 lg:grid-cols-[1.2fr_repeat(4,minmax(0,1fr))]">
          <div className="space-y-4">
            <p className="text-xs uppercase tracking-[0.24em] text-primary-foreground/60">Classifieds</p>
            <h2 className="text-2xl font-semibold tracking-tight text-white">Marketplace</h2>
            <p className="max-w-sm text-sm leading-6 text-primary-foreground/75">
              A clean marketplace for cars, buildings, and land with secure messaging and modern admin tools.
            </p>
          </div>

          {FOOTER_COLUMNS.map((column) => (
            <div key={column.title} className="space-y-4">
              <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-primary-foreground/60">
                {column.title}
              </h3>
              <ul className="space-y-3 text-sm text-primary-foreground/85">
                {column.links.map((link) => (
                  <li key={`${column.title}-${link.label}`}>
                    <Link href={link.href} className="transition hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 flex flex-col gap-3 border-t border-white/15 pt-6 text-sm text-primary-foreground/60 sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} Classifieds Marketplace. All rights reserved.</p>
          <p>Built for secure discovery, direct messaging, and fast listing management.</p>
        </div>
      </div>
    </footer>
  );
}
