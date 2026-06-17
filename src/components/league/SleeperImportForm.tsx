"use client";

import { FormEvent, useState } from "react";

type ImportSummary = {
  leagueId: string;
  leagueName: string;
  season: number;
  week: number;
  teamsImported: number;
  rosteredPlayersImported: number;
  matchupsImported: number;
  warnings: string[];
};

type ImportState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; summary: ImportSummary }
  | { status: "error"; message: string };

export function SleeperImportForm() {
  const [leagueId, setLeagueId] = useState("");
  const [week, setWeek] = useState("1");
  const [state, setState] = useState<ImportState>({ status: "idle" });

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState({ status: "loading" });

    try {
      const response = await fetch("/api/sleeper/import-league", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          leagueId,
          week: Number(week),
        }),
      });
      const payload = await response.json();

      if (!response.ok) {
        setState({
          status: "error",
          message: payload.error ?? "Import failed. Please try again.",
        });
        return;
      }

      setState({ status: "success", summary: payload.summary });
    } catch {
      setState({
        status: "error",
        message: "The import could not start. Check that the app is running.",
      });
    }
  }

  return (
    <form className="grid gap-3" onSubmit={handleSubmit}>
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto_auto]">
        <label className="flex min-w-0 flex-col gap-1">
          <span className="text-xs font-medium text-zinc-600">
            Sleeper league ID
          </span>
          <input
            className="h-11 rounded-md border border-zinc-300 bg-white px-3 text-sm outline-none ring-emerald-600 transition focus:border-emerald-600 focus:ring-2"
            onChange={(event) => setLeagueId(event.target.value)}
            placeholder="Example: 104945..."
            value={leagueId}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-zinc-600">Week</span>
          <input
            className="h-11 w-20 rounded-md border border-zinc-300 bg-white px-3 text-sm outline-none ring-emerald-600 transition focus:border-emerald-600 focus:ring-2"
            max="18"
            min="1"
            onChange={(event) => setWeek(event.target.value)}
            type="number"
            value={week}
          />
        </label>
        <button
          className="mt-5 h-11 rounded-md bg-zinc-950 px-4 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-400"
          disabled={state.status === "loading"}
          type="submit"
        >
          {state.status === "loading" ? "Importing" : "Import"}
        </button>
      </div>

      {state.status === "success" ? (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
          <p>
            Imported {state.summary.leagueName} ({state.summary.season}):{" "}
            {state.summary.teamsImported} teams,{" "}
            {state.summary.rosteredPlayersImported} rostered players, and{" "}
            {state.summary.matchupsImported} matchups for week{" "}
            {state.summary.week}.
          </p>
          <a
            className="mt-3 inline-flex h-9 items-center rounded-md bg-emerald-700 px-3 text-sm font-semibold text-white transition hover:bg-emerald-800"
            href={`/leagues/${state.summary.leagueId}`}
          >
            Open league detail
          </a>
          {state.summary.warnings.length > 0 ? (
            <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 p-3 text-amber-900">
              {state.summary.warnings.map((warning) => (
                <p key={warning}>{warning}</p>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      {state.status === "error" ? (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-900">
          {state.message}
        </div>
      ) : null}
    </form>
  );
}
