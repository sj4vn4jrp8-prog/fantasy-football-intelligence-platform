import Link from "next/link";

const operationSections = [
  {
    title: "Recommendation Systems",
    description:
      "Monitor the engines that create and explain draft recommendations.",
    links: [
      { href: "/decision-engine", label: "Decision Engine" },
      { href: "/knowledge-brain/trust", label: "Recommendation Confidence" },
      { href: "/knowledge-brain/consensus", label: "Expert Agreement" },
      { href: "/knowledge-brain/history", label: "Intelligence History" },
    ],
  },
  {
    title: "Knowledge Brain",
    description:
      "Review expert content, transcript intelligence, and source quality.",
    links: [
      { href: "/knowledge-brain", label: "Knowledge Brain Dashboard" },
      { href: "/knowledge-brain/review", label: "Review Queue" },
      { href: "/knowledge-brain/ask", label: "Ask Stored Knowledge" },
      { href: "/knowledge-brain/import-markdown", label: "Import Transcript" },
      {
        href: "/knowledge-brain/import-markdown/bulk",
        label: "Bulk Transcript Import",
      },
    ],
  },
  {
    title: "Experts",
    description:
      "Manage expert sources, accuracy tracking, and manual outcome grading.",
    links: [
      { href: "/knowledge-brain/experts", label: "Expert Directory" },
      { href: "/knowledge-brain/experts/manage", label: "Manage Experts" },
      { href: "/knowledge-brain/grading", label: "Grade Takes" },
    ],
  },
  {
    title: "Player Intelligence",
    description:
      "Audit player profiles and compare the intelligence behind player calls.",
    links: [
      { href: "/knowledge-brain/players", label: "Player Intelligence" },
      { href: "/knowledge-brain/player-compare", label: "Player Compare" },
    ],
  },
];

export default function IntelligenceOperationsPage() {
  return (
    <main className="min-h-screen bg-stone-50">
      <section className="border-b border-zinc-200 bg-white">
        <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <p className="text-sm font-medium uppercase tracking-[0.18em] text-emerald-700">
            Admin Area
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-normal text-zinc-950 sm:text-4xl">
            Intelligence Operations
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-zinc-600">
            Intelligence Operations is where the platform&apos;s underlying
            recommendation systems are monitored, reviewed, and maintained. Most
            draft users should not need this area.
          </p>
        </div>
      </section>

      <section className="mx-auto grid w-full max-w-7xl gap-4 px-4 py-6 sm:px-6 lg:grid-cols-2 lg:px-8">
        {operationSections.map((section) => (
          <section
            className="rounded-md border border-zinc-200 bg-white p-5"
            key={section.title}
          >
            <h2 className="text-lg font-semibold text-zinc-950">
              {section.title}
            </h2>
            <p className="mt-2 text-sm leading-6 text-zinc-600">
              {section.description}
            </p>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {section.links.map((link) => (
                <Link
                  className="rounded-md border border-zinc-200 px-3 py-2 text-sm font-semibold text-zinc-700 transition hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-800"
                  href={link.href}
                  key={link.href}
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </section>
        ))}
      </section>
    </main>
  );
}
