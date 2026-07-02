import Link from "next/link";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

type DraftReadinessItem = {
  label: string;
  status: "READY" | "NEEDS_ATTENTION";
  summary: string;
};

export default async function Home() {
  const recentLeague = await getRecentLeague();
  const readinessItems = getDraftReadinessItems(Boolean(recentLeague));
  const readyCount = readinessItems.filter((item) => item.status === "READY").length;
  const overallStatus =
    readyCount >= 3 ? "Ready to draft" : "Needs attention";

  return (
    <main className="min-h-screen bg-stone-50">
      <section className="border-b border-zinc-200 bg-white">
        <div className="mx-auto grid w-full max-w-7xl gap-8 px-4 py-12 sm:px-6 lg:grid-cols-[minmax(0,1fr)_380px] lg:px-8">
          <div className="flex flex-col justify-center">
            <p className="text-sm font-medium uppercase tracking-[0.18em] text-emerald-700">
              Fantasy Football Draft Coach
            </p>
            <h1 className="mt-3 max-w-3xl text-4xl font-semibold tracking-normal text-zinc-950 sm:text-5xl">
              Draft smarter with recommendations you can trust.
            </h1>
            <p className="mt-4 max-w-xl text-base leading-7 text-zinc-600">
              Know if you are ready, start your draft, and keep player research
              close without opening the machinery behind the recommendation.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link
                className="inline-flex h-12 items-center justify-center rounded-md bg-emerald-700 px-6 text-sm font-semibold text-white transition hover:bg-emerald-800"
                href={recentLeague ? `/draft?leagueId=${recentLeague.id}` : "/draft"}
              >
                Start Draft
              </Link>
              <Link
                className="inline-flex h-12 items-center justify-center rounded-md border border-zinc-300 bg-white px-5 text-sm font-semibold text-zinc-800 transition hover:bg-zinc-50"
                href="/draft/setup"
              >
                Prepare for Draft
              </Link>
              <Link
                className="inline-flex h-12 items-center justify-center rounded-md px-4 text-sm font-semibold text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-800"
                href="/players"
              >
                View Players
              </Link>
            </div>
          </div>

          <section className="rounded-md border border-zinc-200 bg-stone-50 p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-zinc-500">
                  Current Draft Status
                </p>
                <h2 className="mt-1 text-2xl font-semibold text-zinc-950">
                  {overallStatus}
                </h2>
              </div>
              <span
                className={`rounded-md px-2 py-1 text-xs font-semibold ${
                  overallStatus === "Ready to draft"
                    ? "bg-emerald-100 text-emerald-800"
                    : "bg-amber-100 text-amber-900"
                }`}
              >
                {readyCount}/{readinessItems.length} ready
              </span>
            </div>
            <div className="mt-5 grid gap-3">
              {readinessItems.map((item) => (
                <ReadinessRow item={item} key={item.label} />
              ))}
            </div>
          </section>
        </div>
      </section>

      <section className="mx-auto grid w-full max-w-7xl gap-4 px-4 py-6 sm:px-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:px-8">
        <section className="rounded-md border border-zinc-200 bg-white p-5">
          <p className="text-sm font-semibold text-zinc-500">Recent League</p>
          {recentLeague ? (
            <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-xl font-semibold text-zinc-950">
                  {recentLeague.name}
                </h2>
                <p className="mt-1 text-sm text-zinc-600">
                  {recentLeague.season} season - {recentLeague.platform}
                </p>
              </div>
              <Link
                className="inline-flex h-10 items-center justify-center rounded-md border border-emerald-200 bg-emerald-50 px-4 text-sm font-semibold text-emerald-800 transition hover:bg-emerald-100"
                href={`/draft/setup?leagueId=${recentLeague.id}`}
              >
                Continue Setup
              </Link>
            </div>
          ) : (
            <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 p-4">
              <h2 className="font-semibold text-amber-950">
                Connect a league to unlock league-aware recommendations.
              </h2>
              <p className="mt-1 text-sm leading-6 text-amber-900">
                Use draft setup to import a Sleeper league or continue with
                manual preparation.
              </p>
            </div>
          )}
        </section>

        <section className="rounded-md border border-zinc-200 bg-white p-5">
          <h2 className="text-lg font-semibold text-zinc-950">
            Draft Readiness
          </h2>
          <p className="mt-2 text-sm leading-6 text-zinc-600">
            The next useful step is preparation: confirm league context, choose
            a strategy, paste ADP if you have it, and set draft preferences.
          </p>
          <Link
            className="mt-4 inline-flex h-10 items-center justify-center rounded-md bg-zinc-950 px-4 text-sm font-semibold text-white transition hover:bg-zinc-800"
            href={recentLeague ? `/draft/setup?leagueId=${recentLeague.id}` : "/draft/setup"}
          >
            Prepare for Draft
          </Link>
        </section>
      </section>
    </main>
  );
}

async function getRecentLeague() {
  return db.league.findFirst({
    orderBy: [{ importedAt: "desc" }, { updatedAt: "desc" }],
    select: {
      id: true,
      name: true,
      platform: true,
      season: true,
    },
  });
}

function getDraftReadinessItems(hasLeague: boolean): DraftReadinessItem[] {
  return [
    {
      label: "League",
      status: hasLeague ? "READY" : "NEEDS_ATTENTION",
      summary: hasLeague ? "Connected" : "Connect or import a league",
    },
    {
      label: "ADP",
      status: "NEEDS_ATTENTION",
      summary: "Paste market ranks during setup",
    },
    {
      label: "Strategy",
      status: "NEEDS_ATTENTION",
      summary: "Choose your draft strategy",
    },
    {
      label: "Draft Board",
      status: "READY",
      summary: "Manual board is ready",
    },
  ];
}

function ReadinessRow({ item }: { item: DraftReadinessItem }) {
  const isReady = item.status === "READY";

  return (
    <div className="grid grid-cols-[28px_minmax(0,1fr)] gap-3 rounded-md border border-zinc-200 bg-white px-3 py-3">
      <span
        aria-hidden="true"
        className={`flex h-6 w-6 items-center justify-center rounded-full text-sm font-bold ${
          isReady
            ? "bg-emerald-100 text-emerald-800"
            : "bg-amber-100 text-amber-900"
        }`}
      >
        {isReady ? "OK" : "!"}
      </span>
      <div>
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-semibold text-zinc-950">{item.label}</p>
          <p className="text-xs font-semibold text-zinc-500">
            {isReady ? "Ready" : "Needs attention"}
          </p>
        </div>
        <p className="mt-1 text-sm text-zinc-600">{item.summary}</p>
      </div>
    </div>
  );
}
