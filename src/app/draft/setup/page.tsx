import Link from "next/link";
import type { ReactNode } from "react";
import { SleeperImportForm } from "@/components/league/SleeperImportForm";
import { DRAFT_STRATEGY_PROFILES } from "@/decision-engine/draft-command-center";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

type DraftSetupPageProps = {
  searchParams: Promise<{
    leagueId?: string;
    strategyProfile?: string;
  }>;
};

const strategyDescriptions: Record<(typeof DRAFT_STRATEGY_PROFILES)[number], string> = {
  BALANCED: "Keep the board flexible and avoid forcing one roster build.",
  UPSIDE: "Prefer ceiling and breakout potential when the recommendation is close.",
  HERO_RB: "Prioritize an early anchor running back, then build around receivers and value.",
  ZERO_RB: "Delay running back in early rounds and lean into receivers, tight ends, and value.",
  SAFE_FLOOR: "Prefer stable profiles and reduce exposure to high-risk picks.",
  BEST_PLAYER_AVAILABLE: "Let the strongest recommendation win, with minimal strategy tilt.",
};

export default async function DraftSetupPage({ searchParams }: DraftSetupPageProps) {
  const filters = await searchParams;
  const leagues = await getLeagues();
  const selectedLeagueId = filters.leagueId ?? leagues[0]?.id ?? "";
  const selectedStrategy: (typeof DRAFT_STRATEGY_PROFILES)[number] = DRAFT_STRATEGY_PROFILES.includes(
    filters.strategyProfile as (typeof DRAFT_STRATEGY_PROFILES)[number],
  )
    ? (filters.strategyProfile as (typeof DRAFT_STRATEGY_PROFILES)[number])
    : "BALANCED";

  return (
    <main className="min-h-screen bg-stone-50">
      <section className="border-b border-zinc-200 bg-white">
        <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <p className="text-sm font-medium uppercase tracking-[0.18em] text-emerald-700">
            Draft Setup
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-normal text-zinc-950 sm:text-4xl">
            Prepare for draft day.
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-600">
            Confirm your league, choose a strategy, paste ADP if you have it,
            and set the preferences that will become future recommendation
            inputs.
          </p>
        </div>
      </section>

      <section className="mx-auto grid w-full max-w-7xl gap-4 px-4 py-6 sm:px-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:px-8">
        <form action="/draft" className="grid gap-4">
          <SetupCard
            eyebrow="Step 1"
            title="League"
            description="Use an imported league when available so recommendations can understand scoring and roster settings."
          >
            {leagues.length > 0 ? (
              <label className="grid gap-1 text-sm font-semibold text-zinc-700">
                Recent League
                <select
                  className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950"
                  defaultValue={selectedLeagueId}
                  name="leagueId"
                >
                  {leagues.map((league) => (
                    <option key={league.id} value={league.id}>
                      {league.name} - {league.season}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                No league is connected yet. Import a Sleeper league here, then
                return to setup.
              </div>
            )}
          </SetupCard>

          <SetupCard
            eyebrow="Step 2"
            title="Strategy"
            description="Pick the draft style you want the coach to keep in mind. This is a light input today and will become deeper later."
          >
            <div className="grid gap-3 md:grid-cols-2">
              {DRAFT_STRATEGY_PROFILES.map((strategy) => (
                <label
                  className="rounded-md border border-zinc-200 bg-white p-4 text-sm transition has-[:checked]:border-emerald-300 has-[:checked]:bg-emerald-50"
                  key={strategy}
                >
                  <span className="flex items-center gap-2 font-semibold text-zinc-950">
                    <input
                      className="h-4 w-4 accent-emerald-700"
                      defaultChecked={selectedStrategy === strategy}
                      name="strategyProfile"
                      type="radio"
                      value={strategy}
                    />
                    {formatStrategy(strategy)}
                  </span>
                  <span className="mt-2 block leading-6 text-zinc-600">
                    {strategyDescriptions[strategy]}
                  </span>
                </label>
              ))}
            </div>
          </SetupCard>

          <SetupCard
            eyebrow="Step 3"
            title="ADP"
            description="Paste rankings or ADP rows when you have them. The Draft board can use this to spot values and reaches."
          >
            <label className="grid gap-1 text-sm font-semibold text-zinc-700">
              ADP or Rank Rows
              <textarea
                className="min-h-36 rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950"
                name="adpInput"
                placeholder={"Player,ADP,Rank\nBijan Robinson,3.4,3\nJa'Marr Chase,5.1,5"}
              />
            </label>
          </SetupCard>

          <SetupCard
            eyebrow="Step 4"
            title="Draft Preferences"
            description="These settings are placeholders for future Decision Engine inputs. They make the workflow visible now."
          >
            <div className="grid gap-3 md:grid-cols-2">
              <PreferenceSelect
                label="Preferred QB timing"
                name="preferredQbTiming"
                options={["No preference", "Early", "Middle rounds", "Late"]}
              />
              <PreferenceSelect
                label="Preferred TE timing"
                name="preferredTeTiming"
                options={["No preference", "Early", "Middle rounds", "Late"]}
              />
              <PreferenceSelect
                label="Risk tolerance"
                name="riskTolerance"
                options={["Balanced", "Conservative", "Aggressive"]}
              />
              <PreferenceSelect
                label="Rookie preference"
                name="rookiePreference"
                options={["Balanced", "Prefer rookies", "Avoid rookies"]}
              />
              <PreferenceSelect
                label="Stack preference"
                name="stackPreference"
                options={["No preference", "Prefer stacks", "Avoid forcing stacks"]}
              />
              <label className="flex items-center gap-2 rounded-md border border-zinc-200 bg-white px-3 py-3 text-sm font-semibold text-zinc-700">
                <input
                  className="h-4 w-4 accent-emerald-700"
                  name="autoHideInjured"
                  type="checkbox"
                  value="true"
                />
                Auto-hide injured players
              </label>
            </div>
          </SetupCard>

          <div className="flex flex-wrap gap-3">
            <button
              className="inline-flex h-11 items-center justify-center rounded-md bg-emerald-700 px-5 text-sm font-semibold text-white transition hover:bg-emerald-800"
              type="submit"
            >
              Continue to Draft
            </button>
            <Link
              className="inline-flex h-11 items-center justify-center rounded-md border border-zinc-300 bg-white px-5 text-sm font-semibold text-zinc-800 transition hover:bg-zinc-50"
              href="/"
            >
              Back Home
            </Link>
          </div>
        </form>

        <aside className="grid content-start gap-4">
          <section className="rounded-md border border-zinc-200 bg-white p-5">
            <h2 className="text-lg font-semibold text-zinc-950">
              Draft Readiness
            </h2>
            <div className="mt-4 grid gap-3">
              <ReadinessPill
                label="League"
                ready={Boolean(selectedLeagueId)}
                summary={selectedLeagueId ? "Connected" : "Needs setup"}
              />
              <ReadinessPill
                label="ADP"
                ready={false}
                summary="Optional, not saved yet"
              />
              <ReadinessPill
                label="Strategy"
                ready
                summary={formatStrategy(selectedStrategy)}
              />
              <ReadinessPill label="Draft Board" ready summary="Manual board ready" />
            </div>
          </section>

          <section className="rounded-md border border-zinc-200 bg-white p-5">
            <h2 className="text-lg font-semibold text-zinc-950">
              Import Sleeper League
            </h2>
            <p className="mt-2 text-sm leading-6 text-zinc-600">
              Importing a league adds scoring, roster settings, teams, and
              rosters for better draft context.
            </p>
            <div className="mt-4">
              <SleeperImportForm />
            </div>
          </section>
        </aside>
      </section>
    </main>
  );
}

async function getLeagues() {
  return db.league.findMany({
    orderBy: [{ importedAt: "desc" }, { updatedAt: "desc" }],
    select: {
      id: true,
      name: true,
      season: true,
    },
    take: 10,
  });
}

function SetupCard({
  children,
  description,
  eyebrow,
  title,
}: {
  children: ReactNode;
  description: string;
  eyebrow: string;
  title: string;
}) {
  return (
    <section className="rounded-md border border-zinc-200 bg-white p-5">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-700">
        {eyebrow}
      </p>
      <h2 className="mt-2 text-xl font-semibold text-zinc-950">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-zinc-600">{description}</p>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function PreferenceSelect({
  label,
  name,
  options,
}: {
  label: string;
  name: string;
  options: string[];
}) {
  return (
    <label className="grid gap-1 text-sm font-semibold text-zinc-700">
      {label}
      <select
        className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950"
        name={name}
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

function ReadinessPill({
  label,
  ready,
  summary,
}: {
  label: string;
  ready: boolean;
  summary: string;
}) {
  return (
    <div className="rounded-md border border-zinc-200 px-3 py-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-zinc-950">{label}</p>
        <span
          className={`rounded-md px-2 py-1 text-xs font-semibold ${
            ready ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-900"
          }`}
        >
          {ready ? "Ready" : "Needs attention"}
        </span>
      </div>
      <p className="mt-1 text-sm text-zinc-600">{summary}</p>
    </div>
  );
}

function formatStrategy(strategy: (typeof DRAFT_STRATEGY_PROFILES)[number]) {
  const labels: Record<(typeof DRAFT_STRATEGY_PROFILES)[number], string> = {
    BALANCED: "Balanced",
    BEST_PLAYER_AVAILABLE: "Best Player Available",
    HERO_RB: "Hero RB",
    SAFE_FLOOR: "Safe Floor",
    UPSIDE: "Upside",
    ZERO_RB: "Zero RB",
  };

  return labels[strategy];
}
