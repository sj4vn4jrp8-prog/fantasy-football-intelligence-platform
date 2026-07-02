"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { href: "/", label: "Home", activePaths: ["/"] },
  {
    href: "/draft",
    label: "Draft",
    activePaths: ["/draft", "/draft-command-center"],
  },
  {
    href: "/players",
    label: "Players",
    activePaths: ["/players", "/knowledge-brain/players"],
  },
  { href: "/settings", label: "Settings", activePaths: ["/settings"] },
];

export function ProductNav() {
  const pathname = usePathname();

  return (
    <header className="border-b border-zinc-200 bg-white">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
        <Link
          className="text-sm font-semibold uppercase tracking-[0.16em] text-emerald-700"
          href="/"
        >
          Fantasy Draft Coach
        </Link>
        <nav
          aria-label="Primary navigation"
          className="flex flex-wrap items-center gap-1 text-sm font-semibold"
        >
          {navItems.map((item) => {
            const isActive = item.activePaths.some((activePath) =>
              activePath === "/"
                ? pathname === "/"
                : pathname === activePath || pathname.startsWith(`${activePath}/`),
            );

            return (
              <Link
                aria-current={isActive ? "page" : undefined}
                className={`rounded-md px-3 py-2 transition ${
                  isActive
                    ? "bg-emerald-50 text-emerald-800"
                    : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-950"
                }`}
                href={item.href}
                key={item.href}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
