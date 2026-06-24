"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

type FantasyProsProjectionImportSummary = {
  leagueName: string;
  week: number;
  provider: string;
  projectionsReturned?: number;
  playersConsidered: number;
  playersMatched?: number;
  playersUnmatched?: number;
  projectionsImported: number;
  warnings?: string[];
};

type ImportState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; summary: FantasyProsProjectionImportSummary }
  | { status: "error"; message: string };

export function FantasyProsProjectionImportForm({
  leagueId,
  defaultWeek = 1,
}: {
  leagueId: string;
  defaultWeek?: number;
}) {
  const router = useRouter();
  const [week, setWeek] = useState(String(defaultWeek));
  const [state, setState] = useState<ImportState>({ status: "idle" });

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState({ status: "loading" });

    try {
      const response = await fetch(
        `/api/leagues/${leagueId}/fantasypros-projections`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            week: Number(week),
          }),
        },
      );
      const payload = await response.json();

      if (!response.ok) {
        setState({
          status: "error",
          message:
            payload.error ?? "FantasyPros projections could not be imported.",
        });
        return;
      }

      setState({ status: "success", summary: payload.summary });
      router.refresh();
    } catch {
      setState({
        status: "error",
        message: "FantasyPros projections could not be imported.",
      });
    }
  }

  return (
    <form className="grid gap-3 sm:max-w-xl" onSubmit={handleSubmit}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-zinc-600">Week</span>
          <input
            className="h-10 w-24 rounded-md border border-zinc-300 bg-white px-3 text-sm outline-none ring-emerald-600 transition focus:border-emerald-600 focus:ring-2"
            max="18"
            min="1"
            onChange={(event) => setWeek(event.target.value)}
            type="number"
            value={week}
          />
        </label>
        <button
          className="h-10 rounded-md bg-emerald-700 px-4 text-sm font-semibold text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:bg-zinc-400"
          disabled={state.status === "loading"}
          type="submit"
        >
          {state.status === "loading"
            ? "Importing"
            : "Import FantasyPros projections"}
        </button>
      </div>

      {state.status === "success" ? (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
          Saved {state.summary.projectionsImported}{" "}
          {state.summary.provider} projections for week {state.summary.week}.
          {typeof state.summary.playersMatched === "number" ? (
            <span>
              {" "}
              Matched {state.summary.playersMatched} of{" "}
              {state.summary.playersConsidered} rostered players.
            </span>
          ) : null}
          {state.summary.warnings?.length ? (
            <div className="mt-2">{state.summary.warnings.join(" ")}</div>
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
