import Link from "next/link";
import { getPlayerIntelligenceDirectory } from "@/knowledge-brain/player-intelligence";
import { getPlayerThesesForPlayers } from "@/knowledge-brain/player-thesis";

export const dynamic = "force-dynamic";

type PlayerIntelligenceDirectoryPageProps = {
  searchParams: Promise<{
    freshness?: string;
    includeHistorical?: string;
    draftConfidence?: string;
    draftPosture?: string;
    evidenceStrength?: string;
    position?: string;
    q?: string;
    targetSeason?: string;
    team?: string;
  }>;
};

export default async function PlayerIntelligenceDirectoryPage({
  searchParams,
}: PlayerIntelligenceDirectoryPageProps) {
  const filters = await searchParams;
  const directory = await getPlayerIntelligenceDirectory({
    search: filters.q,
    position: filters.position,
    team: filters.team,
    freshness: filters.freshness,
    includeHistorical: filters.includeHistorical === "true",
    targetSeason: filters.targetSeason,
  });
  const playerTheses = await getPlayerThesesForPlayers(
    directory.players.map((player) => player.playerId),
    {
      includeHistorical: filters.includeHistorical === "true",
      targetSeason: filters.targetSeason,
    },
  );
  const thesisByPlayerId = new Map(
    playerTheses.map((thesis) => [thesis.player.id, thesis]),
  );
  const visiblePlayers = directory.players.filter((player) => {
    const thesis = thesisByPlayerId.get(player.playerId);
    const matchesDraftPosture = filters.draftPosture
      ? thesis?.draftRecommendationPosture === filters.draftPosture
      : true;
    const matchesEvidenceStrength = filters.evidenceStrength
      ? thesis?.evidenceStrength.label === filters.evidenceStrength
      : true;
    const matchesDraftConfidence = filters.draftConfidence
      ? thesis?.confidence.label === filters.draftConfidence
      : true;

    return (
      matchesDraftPosture &&
      matchesEvidenceStrength &&
      matchesDraftConfidence
    );
  });
  const draftPostureOptions = Array.from(
    new Set(playerTheses.map((thesis) => thesis.draftRecommendationPosture)),
  ).sort();
  const evidenceStrengthOptions = Array.from(
    new Set(playerTheses.map((thesis) => thesis.evidenceStrength.label)),
  ).sort();
  const draftConfidenceOptions = Array.from(
    new Set(playerTheses.map((thesis) => thesis.confidence.label)),
  ).sort();

  return (
    <main className="min-h-screen bg-stone-50">
      <section className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex flex-wrap gap-3">
            <Link
              className="text-sm font-semibold text-emerald-700 hover:text-emerald-900"
              href="/knowledge-brain"
            >
              Back to Knowledge Brain
            </Link>
            <Link
              className="text-sm font-semibold text-zinc-600 hover:text-zinc-950"
              href="/knowledge-brain/player-compare"
            >
              Compare Players
            </Link>
          </div>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-sm font-medium uppercase tracking-[0.18em] text-emerald-700">
                Player Intelligence
              </p>
              <h1 className="mt-2 text-3xl font-semibold tracking-normal text-zinc-950 sm:text-4xl">
                Intelligence Directory
              </h1>
            </div>
            <SummaryItem
              label="Researchable Players"
              value={String(visiblePlayers.length)}
            />
          </div>
        </div>
      </section>

      <section className="mx-auto grid w-full max-w-7xl gap-4 px-4 py-5 sm:px-6 lg:px-8">
        <Card title="Filters">
          <form
            action="/knowledge-brain/players"
            className="grid gap-3 md:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_110px_120px_120px_170px_170px_150px_150px]"
          >
            <label className="grid gap-1 text-sm font-semibold text-zinc-700">
              Search
              <input
                className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950"
                defaultValue={filters.q ?? ""}
                name="q"
                placeholder="Player name"
              />
            </label>
            <label className="grid gap-1 text-sm font-semibold text-zinc-700">
              Season
              <input
                className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950"
                defaultValue={String(directory.filters.targetSeason)}
                min="2000"
                name="targetSeason"
                type="number"
              />
            </label>
            <label className="grid gap-1 text-sm font-semibold text-zinc-700">
              Position
              <select
                className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950"
                defaultValue={filters.position ?? ""}
                name="position"
              >
                <option value="">All</option>
                {directory.positionOptions.map((position) => (
                  <option key={position} value={position}>
                    {position}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1 text-sm font-semibold text-zinc-700">
              NFL Team
              <select
                className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950"
                defaultValue={filters.team ?? ""}
                name="team"
              >
                <option value="">All</option>
                {directory.teamOptions.map((team) => (
                  <option key={team} value={team}>
                    {team}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1 text-sm font-semibold text-zinc-700">
              Freshness
              <select
                className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950"
                defaultValue={directory.filters.freshness}
                name="freshness"
              >
                <option value="ALL">All included</option>
                {directory.filters.freshnessOptions.map((freshness) => (
                  <option key={freshness} value={freshness}>
                    {formatEnumLabel(freshness)}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1 text-sm font-semibold text-zinc-700">
              Draft Posture
              <select
                className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950"
                defaultValue={filters.draftPosture ?? ""}
                name="draftPosture"
              >
                <option value="">All</option>
                {draftPostureOptions.map((posture) => (
                  <option key={posture} value={posture}>
                    {posture}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1 text-sm font-semibold text-zinc-700">
              Evidence
              <select
                className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950"
                defaultValue={filters.evidenceStrength ?? ""}
                name="evidenceStrength"
              >
                <option value="">All</option>
                {evidenceStrengthOptions.map((strength) => (
                  <option key={strength} value={strength}>
                    {strength}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1 text-sm font-semibold text-zinc-700">
              Confidence
              <select
                className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950"
                defaultValue={filters.draftConfidence ?? ""}
                name="draftConfidence"
              >
                <option value="">All</option>
                {draftConfidenceOptions.map((confidence) => (
                  <option key={confidence} value={confidence}>
                    {confidence}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex items-end gap-2 rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm font-semibold text-zinc-700">
              <input
                className="h-4 w-4"
                defaultChecked={directory.filters.includeHistorical}
                name="includeHistorical"
                type="checkbox"
                value="true"
              />
              Historical
            </label>
            <div className="flex items-end gap-2 xl:col-span-8">
              <button
                className="h-10 rounded-md bg-emerald-700 px-4 text-sm font-semibold text-white transition hover:bg-emerald-800"
                type="submit"
              >
                Apply
              </button>
              <Link
                className="inline-flex h-10 items-center rounded-md border border-zinc-300 bg-white px-4 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-100"
                href="/knowledge-brain/players"
              >
                Reset
              </Link>
            </div>
          </form>
        </Card>

        <Card title="Player Research Board">
          <p className="mb-4 text-sm leading-6 text-zinc-600">
            Draft Case headline is the manager-facing read. Mention counts and
            intelligence scores still exist, but this board leads with draft
            posture, confidence, and evidence strength.
          </p>
          {visiblePlayers.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1100px] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-zinc-200 text-xs uppercase text-zinc-500">
                    <th className="py-2 pr-4 font-semibold">Player</th>
                    <th className="py-2 pr-4 font-semibold">Pos / Team</th>
                    <th className="py-2 pr-4 font-semibold">Draft Case</th>
                    <th className="py-2 pr-4 font-semibold">Draft Posture</th>
                    <th className="py-2 pr-4 font-semibold">Confidence</th>
                    <th className="py-2 pr-4 font-semibold">Evidence</th>
                    <th className="py-2 pr-4 font-semibold">Latest</th>
                    <th className="py-2 pr-4 font-semibold">Mentions</th>
                    <th className="py-2 font-semibold">Open</th>
                  </tr>
                </thead>
                <tbody>
                  {visiblePlayers.map((player) => {
                    const thesis = thesisByPlayerId.get(player.playerId);

                    return (
                      <tr
                        className="border-b border-zinc-100"
                        key={player.playerId}
                      >
                        <td className="py-3 pr-4 font-semibold text-zinc-950">
                          <Link
                            className="text-emerald-700 hover:text-emerald-900"
                            href={buildPlayerHref(player.playerId, directory)}
                          >
                            {player.fullName}
                          </Link>
                        </td>
                        <td className="py-3 pr-4 text-zinc-700">
                          {player.position}
                          {player.team ? ` / ${player.team}` : ""}
                        </td>
                        <td className="max-w-md py-3 pr-4 text-zinc-700">
                          {thesis?.thesisHeadline ??
                            "No approved draft case yet."}
                        </td>
                        <td className="py-3 pr-4 text-zinc-700">
                          <span
                            className={`rounded-md px-2 py-1 text-xs font-semibold ${getDraftPostureTone(
                              thesis?.draftRecommendationPosture,
                            )}`}
                          >
                            {thesis?.draftRecommendationPosture ?? "Research"}
                          </span>
                        </td>
                        <td className="py-3 pr-4 text-zinc-700">
                          {thesis
                            ? `${thesis.confidence.label} (${thesis.confidence.score}/100)`
                            : "--"}
                        </td>
                        <td className="py-3 pr-4 text-zinc-700">
                          {thesis?.evidenceStrength.label ?? "--"}
                        </td>
                        <td className="py-3 pr-4 text-zinc-700">
                          {formatDate(player.latestMentionDate)}
                        </td>
                        <td className="py-3 pr-4 text-zinc-700">
                          {player.totalMentions}
                        </td>
                        <td className="py-3">
                          <Link
                            className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-xs font-semibold text-zinc-700 transition hover:bg-zinc-100"
                            href={buildPlayerHref(player.playerId, directory)}
                          >
                            Research
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState message="No player intelligence matches those filters yet." />
          )}
        </Card>
      </section>
    </main>
  );
}

function Card({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-md border border-zinc-200 bg-white p-5">
      <h2 className="text-lg font-semibold text-zinc-950">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-zinc-200 bg-zinc-50 px-4 py-3">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">
        {label}
      </p>
      <p className="mt-1 text-sm font-semibold text-zinc-950">{value}</p>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-md border border-dashed border-zinc-300 bg-zinc-50 p-4 text-sm text-zinc-600">
      {message}
    </div>
  );
}

function buildPlayerHref(
  playerId: string,
  directory: {
    filters: {
      freshness: string;
      includeHistorical: boolean;
      targetSeason: number;
    };
  },
) {
  return `/knowledge-brain/players/${playerId}?targetSeason=${
    directory.filters.targetSeason
  }&freshness=${directory.filters.freshness}${
    directory.filters.includeHistorical ? "&includeHistorical=true" : ""
  }`;
}

function getDraftPostureTone(posture?: string) {
  if (posture === "Draft Target" || posture === "Value Target") {
    return "bg-emerald-100 text-emerald-800";
  }
  if (posture === "Avoid At Cost" || posture === "Discount Only") {
    return "bg-red-100 text-red-800";
  }
  if (posture === "Proceed Carefully") {
    return "bg-amber-100 text-amber-900";
  }

  return "bg-zinc-200 text-zinc-700";
}

function formatDate(value: Date | null) {
  if (!value) return "--";

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(value);
}

function formatEnumLabel(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}
