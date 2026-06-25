import Link from "next/link";
import { BrainAskForm } from "@/components/knowledge-brain/BrainAskForm";
import { getDefaultTargetSeason } from "@/knowledge-brain/freshness";

export const dynamic = "force-dynamic";

export default function KnowledgeBrainAskPage() {
  return (
    <main className="min-h-screen bg-stone-50">
      <section className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-4 py-6 sm:px-6 lg:px-8">
          <Link
            className="text-sm font-semibold text-emerald-700 hover:text-emerald-900"
            href="/knowledge-brain"
          >
            Back to Knowledge Brain
          </Link>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-sm font-medium uppercase tracking-[0.18em] text-emerald-700">
                Ask the Knowledge Brain
              </p>
              <h1 className="mt-2 text-3xl font-semibold tracking-normal text-zinc-950 sm:text-4xl">
                Search Expert Takes
              </h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-zinc-600">
                Ask natural-language fantasy football questions against stored
                transcript data, player intelligence, expert consensus, weighted
                consensus, and manual accuracy records.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link
                className="inline-flex h-10 items-center justify-center rounded-md border border-zinc-300 bg-white px-4 text-sm font-semibold text-zinc-800 transition hover:bg-zinc-50"
                href="/knowledge-brain/players"
              >
                Player Intelligence
              </Link>
              <Link
                className="inline-flex h-10 items-center justify-center rounded-md border border-zinc-300 bg-white px-4 text-sm font-semibold text-zinc-800 transition hover:bg-zinc-50"
                href="/knowledge-brain/consensus"
              >
                Expert Consensus
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-7xl px-4 py-5 sm:px-6 lg:px-8">
        <BrainAskForm defaultTargetSeason={getDefaultTargetSeason()} />
      </section>
    </main>
  );
}
