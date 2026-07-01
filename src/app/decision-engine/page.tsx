import Link from "next/link";
import { getDecisionEngineDashboard } from "@/decision-engine";
import { formatRecommendationType } from "@/decision-engine/recommendation-explainer";
import type {
  DecisionRecommendation,
  DecisionRecommendationType,
  RiskFactor,
} from "@/decision-engine";

export const dynamic = "force-dynamic";

type DecisionEnginePageProps = {
  searchParams: Promise<{
    includeHistorical?: string;
    limit?: string;
    position?: string;
    targetSeason?: string;
  }>;
};

export default async function DecisionEnginePage({
  searchParams,
}: DecisionEnginePageProps) {
  const filters = await searchParams;
  const dashboard = await getDecisionEngineDashboard({
    includeHistorical: filters.includeHistorical === "true",
    limit: filters.limit,
    position: filters.position,
    targetSeason: filters.targetSeason,
  });

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
              href="/draft-command-center"
            >
              Draft Command Center
            </Link>
            <Link
              className="text-sm font-semibold text-zinc-600 hover:text-zinc-950"
              href="/knowledge-brain/trust"
            >
              Trust Engine
            </Link>
            <Link
              className="text-sm font-semibold text-zinc-600 hover:text-zinc-950"
              href="/knowledge-brain/history"
            >
              Time Machine
            </Link>
          </div>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-sm font-medium uppercase tracking-[0.18em] text-emerald-700">
                Decision Engine
              </p>
              <h1 className="mt-2 text-3xl font-semibold tracking-normal text-zinc-950 sm:text-4xl">
                Recommendation Foundation
              </h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-600">
                This developer preview converts Trust Score, Expert Memory,
                Player Intelligence, consensus agreement, evidence quality, and
                risk signals into reusable recommendation objects for future
                draft, start/sit, waiver, and trade tools.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <SummaryItem
                label="Recommendations"
                value={String(dashboard.recommendations.length)}
              />
              <SummaryItem
                label="Trust Profiles"
                value={String(dashboard.sourceCounts.playerTrustProfiles)}
              />
              <SummaryItem
                label="Expert Memory"
                value={String(dashboard.sourceCounts.expertMemoryRows)}
              />
              <SummaryItem
                label="Season"
                value={String(dashboard.filters.targetSeason)}
              />
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto grid w-full max-w-7xl gap-4 px-4 py-5 sm:px-6 lg:px-8">
        <Card title="Recommendation Scope">
          <form
            action="/decision-engine"
            className="grid gap-3 lg:grid-cols-[150px_180px_150px_minmax(0,1fr)_auto]"
          >
            <label className="grid gap-1 text-sm font-semibold text-zinc-700">
              Target Season
              <input
                className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950"
                defaultValue={String(dashboard.filters.targetSeason)}
                min="2000"
                name="targetSeason"
                type="number"
              />
            </label>
            <label className="grid gap-1 text-sm font-semibold text-zinc-700">
              Position
              <select
                className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950"
                defaultValue={dashboard.filters.position ?? ""}
                name="position"
              >
                <option value="">All</option>
                {dashboard.positionOptions.map((position) => (
                  <option key={position} value={position}>
                    {position}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1 text-sm font-semibold text-zinc-700">
              Limit
              <input
                className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950"
                defaultValue={String(dashboard.filters.limit)}
                min="5"
                name="limit"
                type="number"
              />
            </label>
            <label className="flex items-end gap-2 rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm font-semibold text-zinc-700">
              <input
                className="h-4 w-4"
                defaultChecked={dashboard.filters.includeHistorical}
                name="includeHistorical"
                type="checkbox"
                value="true"
              />
              Include historical/stale content
            </label>
            <div className="flex items-end gap-2">
              <button
                className="h-10 rounded-md bg-emerald-700 px-4 text-sm font-semibold text-white transition hover:bg-emerald-800"
                type="submit"
              >
                Apply
              </button>
              <Link
                className="inline-flex h-10 items-center rounded-md border border-zinc-300 bg-white px-4 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-100"
                href="/decision-engine"
              >
                Reset
              </Link>
            </div>
          </form>
        </Card>

        <section className="grid gap-4 xl:grid-cols-4">
          <RecommendationWidget
            emptyMessage="No strong recommendations yet."
            recommendations={dashboard.widgets.strongestRecommendations}
            title="Strongest Recommendations"
          />
          <RecommendationWidget
            emptyMessage="No draft/value targets yet."
            recommendations={dashboard.widgets.draftTargets}
            title="Draft / Value Targets"
          />
          <RecommendationWidget
            emptyMessage="No avoid signals yet."
            recommendations={dashboard.widgets.avoidList}
            title="Avoid List"
          />
          <RecommendationWidget
            emptyMessage="No watch-list recommendations yet."
            recommendations={dashboard.widgets.watchList}
            title="Watch List"
          />
        </section>

        <section className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_360px]">
          <Card title="Decision Model">
            <div className="grid gap-3 md:grid-cols-2">
              <ModelItem
                label="Decision Score"
                text="Measures recommendation strength. It is separate from Trust Score and changes by action type."
              />
              <ModelItem
                label="Trust Score"
                text="Measures reliability of the underlying intelligence. It is an input, not the final recommendation."
              />
              <ModelItem
                label="Risk Engine"
                text="Flags small samples, disagreement, low trust, volatile memory, quality warnings, and declining snapshots."
              />
              <ModelItem
                label="Future Inputs"
                text="ADP, league scoring, roster fit, position scarcity, bye weeks, user preferences, and injury data are neutral placeholders."
              />
            </div>
            <div className="mt-4 rounded-md border border-zinc-200 bg-zinc-50 p-3">
              <p className="text-sm font-semibold text-zinc-950">
                Supported recommendation categories
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {dashboard.supportedRecommendationTypes.map((type) => (
                  <span
                    className="rounded-md bg-white px-2 py-1 text-xs font-semibold text-zinc-700 ring-1 ring-zinc-200"
                    key={type}
                  >
                    {formatRecommendationType(type)}
                  </span>
                ))}
              </div>
            </div>
          </Card>

          <Card title="Source Inputs">
            <div className="grid gap-2">
              <SourceCount
                label="Player Trust Profiles"
                value={dashboard.sourceCounts.playerTrustProfiles}
              />
              <SourceCount
                label="Player Intelligence"
                value={dashboard.sourceCounts.playerIntelligenceRows}
              />
              <SourceCount
                label="Expert Memory"
                value={dashboard.sourceCounts.expertMemoryRows}
              />
              <SourceCount
                label="Raw Consensus"
                value={dashboard.sourceCounts.consensusRows}
              />
              <SourceCount
                label="Weighted Consensus"
                value={dashboard.sourceCounts.weightedConsensusRows}
              />
            </div>
          </Card>
        </section>

        <Card title="Recommendations">
          {dashboard.recommendations.length > 0 ? (
            <div className="grid gap-4">
              {dashboard.recommendations.map((recommendation) => (
                <RecommendationCard
                  key={recommendation.id}
                  recommendation={recommendation}
                />
              ))}
            </div>
          ) : (
            <EmptyState message="No recommendation candidates are available yet. Add or approve current-season Knowledge Brain intelligence to create Decision Engine inputs." />
          )}
        </Card>
      </section>
    </main>
  );
}

function RecommendationCard({
  recommendation,
}: {
  recommendation: DecisionRecommendation;
}) {
  return (
    <article className="rounded-md border border-zinc-200 bg-white p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className={getTypeClass(recommendation.type)}>
              {formatRecommendationType(recommendation.type)}
            </span>
            <span className="rounded-md bg-zinc-100 px-2 py-1 text-xs font-semibold text-zinc-700">
              {recommendation.decisionScore.strength}
            </span>
            <span className="rounded-md bg-sky-50 px-2 py-1 text-xs font-semibold text-sky-800">
              {recommendation.decisionScore.confidence} confidence
            </span>
          </div>
          <h2 className="mt-2 text-lg font-semibold text-zinc-950">
            {recommendation.title}
          </h2>
          <p className="mt-1 text-sm text-zinc-600">
            {recommendation.subject.position}
            {recommendation.subject.team ? `, ${recommendation.subject.team}` : ""}
          </p>
        </div>
        <div className="rounded-md border border-zinc-200 px-4 py-3 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">
            Decision Score
          </p>
          <p className="mt-1 text-3xl font-semibold text-zinc-950">
            {recommendation.decisionScore.score}
          </p>
          <p className="text-xs font-medium text-zinc-500">
            {recommendation.decisionScore.scoreLabel}
          </p>
        </div>
      </div>

      <p className="mt-4 rounded-md border border-emerald-100 bg-emerald-50 p-3 text-sm leading-6 text-emerald-950">
        {recommendation.explanation}
      </p>

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <div>
          <h3 className="text-sm font-semibold text-zinc-950">
            Supporting Factors
          </h3>
          <div className="mt-2 grid gap-2">
            {recommendation.supportingFactors.slice(0, 5).map((factor) => (
              <FactorRow
                detail={factor.explanation}
                key={factor.key}
                label={factor.label}
                value={factor.value}
              />
            ))}
          </div>
        </div>
        <div>
          <h3 className="text-sm font-semibold text-zinc-950">Risk Factors</h3>
          <div className="mt-2 grid gap-2">
            {recommendation.riskFactors.length > 0 ? (
              recommendation.riskFactors.slice(0, 5).map((risk) => (
                <RiskRow key={risk.key} risk={risk} />
              ))
            ) : (
              <p className="rounded-md border border-zinc-200 bg-zinc-50 p-3 text-sm text-zinc-600">
                No major deterministic risk flags.
              </p>
            )}
          </div>
        </div>
        <div>
          <h3 className="text-sm font-semibold text-zinc-950">
            Alternatives
          </h3>
          <div className="mt-2 grid gap-2">
            {recommendation.alternatives.length > 0 ? (
              recommendation.alternatives.map((alternative) => (
                <div
                  className="rounded-md border border-zinc-200 bg-zinc-50 p-3"
                  key={alternative.playerId}
                >
                  <p className="font-semibold text-zinc-950">
                    {alternative.playerName}
                  </p>
                  <p className="text-sm text-zinc-600">
                    {formatRecommendationType(alternative.recommendationType)}:
                    {" "}
                    {alternative.decisionScore}
                  </p>
                </div>
              ))
            ) : (
              <p className="rounded-md border border-zinc-200 bg-zinc-50 p-3 text-sm text-zinc-600">
                No same-position alternatives in this result set.
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div>
          <h3 className="text-sm font-semibold text-zinc-950">Evidence</h3>
          {recommendation.evidence.length > 0 ? (
            <div className="mt-2 grid gap-2">
              {recommendation.evidence.slice(0, 4).map((evidence) => (
                <div
                  className="rounded-md border border-zinc-200 bg-zinc-50 p-3"
                  key={`${evidence.source}-${evidence.label}-${evidence.summary}`}
                >
                  <p className="text-sm font-semibold text-zinc-950">
                    {evidence.label}
                  </p>
                  <p className="text-xs font-medium text-zinc-500">
                    {evidence.source}
                    {evidence.publishedAt
                      ? `, ${formatDate(evidence.publishedAt)}`
                      : ""}
                  </p>
                  <p className="mt-2 text-sm leading-6 text-zinc-700">
                    {evidence.summary}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState message="No evidence pointers are available for this recommendation." />
          )}
        </div>
        <div>
          <h3 className="text-sm font-semibold text-zinc-950">
            Score Components
          </h3>
          <div className="mt-2 grid gap-2">
            {recommendation.decisionScore.components.map((component) => (
              <div
                className="rounded-md border border-zinc-200 bg-white p-3"
                key={component.key}
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-zinc-950">
                    {component.label}
                  </p>
                  <p className="text-sm font-semibold text-zinc-700">
                    {component.rawValue}
                  </p>
                </div>
                <div className="mt-2 h-2 rounded-full bg-zinc-100">
                  <div
                    className="h-2 rounded-full bg-emerald-600"
                    style={{ width: `${component.rawValue}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </article>
  );
}

function RecommendationWidget({
  emptyMessage,
  recommendations,
  title,
}: {
  emptyMessage: string;
  recommendations: DecisionRecommendation[];
  title: string;
}) {
  return (
    <Card title={title}>
      {recommendations.length > 0 ? (
        <div className="grid gap-2">
          {recommendations.map((recommendation) => (
            <div
              className="rounded-md border border-zinc-200 bg-zinc-50 p-3"
              key={`${title}-${recommendation.id}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-zinc-950">
                    {recommendation.subject.playerName}
                  </p>
                  <p className="text-xs font-medium text-zinc-500">
                    {recommendation.subject.position}
                    {recommendation.subject.team
                      ? `, ${recommendation.subject.team}`
                      : ""}
                  </p>
                </div>
                <span className="rounded-md bg-white px-2 py-1 text-xs font-semibold text-zinc-800 ring-1 ring-zinc-200">
                  {recommendation.decisionScore.score}
                </span>
              </div>
              <p className="mt-2 text-sm text-zinc-600">
                {formatRecommendationType(recommendation.type)}
              </p>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState message={emptyMessage} />
      )}
    </Card>
  );
}

function FactorRow({
  detail,
  label,
  value,
}: {
  detail: string;
  label: string;
  value: number | string;
}) {
  return (
    <div className="rounded-md border border-zinc-200 bg-zinc-50 p-3">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-semibold text-zinc-950">{label}</p>
        <span className="rounded-md bg-white px-2 py-1 text-xs font-semibold text-zinc-700 ring-1 ring-zinc-200">
          {value}
        </span>
      </div>
      <p className="mt-2 text-sm leading-6 text-zinc-600">{detail}</p>
    </div>
  );
}

function RiskRow({ risk }: { risk: RiskFactor }) {
  return (
    <div className="rounded-md border border-zinc-200 bg-zinc-50 p-3">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-semibold text-zinc-950">{risk.label}</p>
        <span className={getRiskClass(risk.severity)}>{risk.severity}</span>
      </div>
      <p className="mt-2 text-sm leading-6 text-zinc-600">
        {risk.explanation}
      </p>
    </div>
  );
}

function ModelItem({ label, text }: { label: string; text: string }) {
  return (
    <div className="rounded-md border border-zinc-200 bg-zinc-50 p-3">
      <p className="font-semibold text-zinc-950">{label}</p>
      <p className="mt-1 text-sm leading-6 text-zinc-600">{text}</p>
    </div>
  );
}

function SourceCount({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between rounded-md border border-zinc-200 bg-zinc-50 p-3">
      <p className="text-sm font-semibold text-zinc-700">{label}</p>
      <p className="font-semibold text-zinc-950">{value}</p>
    </div>
  );
}

function Card({
  children,
  title,
}: {
  children: React.ReactNode;
  title: string;
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
      <p className="mt-1 text-xl font-semibold text-zinc-950">{value}</p>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <p className="rounded-md border border-dashed border-zinc-300 bg-zinc-50 p-4 text-sm text-zinc-600">
      {message}
    </p>
  );
}

function getTypeClass(type: DecisionRecommendationType) {
  if (["DRAFT", "VALUE", "BUY", "REACH", "START", "WAIVER_ADD"].includes(type)) {
    return "rounded-md bg-emerald-100 px-2 py-1 text-xs font-semibold text-emerald-800";
  }
  if (["AVOID", "SELL", "SIT"].includes(type)) {
    return "rounded-md bg-rose-100 px-2 py-1 text-xs font-semibold text-rose-800";
  }

  return "rounded-md bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-900";
}

function getRiskClass(severity: RiskFactor["severity"]) {
  if (severity === "High") {
    return "rounded-md bg-rose-100 px-2 py-1 text-xs font-semibold text-rose-800";
  }
  if (severity === "Medium") {
    return "rounded-md bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-900";
  }

  return "rounded-md bg-zinc-100 px-2 py-1 text-xs font-semibold text-zinc-700";
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}
