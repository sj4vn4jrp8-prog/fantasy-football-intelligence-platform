"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import type { BrainSearchAnswer } from "@/knowledge-brain/brain-search";

type FormState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; answer: BrainSearchAnswer }
  | { status: "error"; message: string };

const ASK_API_URL = "/api/knowledge-brain/ask";
const QUICK_PROMPTS = [
  "Who are experts most bullish on?",
  "Who are experts fading?",
  "Show divisive players",
  "Show strongest Trust Score signals",
  "Latest takes",
] as const;

export function BrainAskForm({ defaultTargetSeason }: { defaultTargetSeason: number }) {
  const [question, setQuestion] = useState("");
  const [targetSeason, setTargetSeason] = useState(String(defaultTargetSeason));
  const [includeHistorical, setIncludeHistorical] = useState(false);
  const [state, setState] = useState<FormState>({ status: "idle" });

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await askQuestion(question);
  }

  async function askQuestion(nextQuestion: string) {
    const trimmedQuestion = nextQuestion.trim();

    if (!trimmedQuestion) {
      setState({
        status: "error",
        message: "Enter a question before asking the Knowledge Brain.",
      });
      return;
    }

    setQuestion(trimmedQuestion);
    setState({ status: "loading" });

    try {
      const response = await fetch(ASK_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          question: trimmedQuestion,
          targetSeason,
          includeHistorical,
        }),
      });
      const payload = await readJsonResponse(response);

      if (!response.ok) {
        setState({
          status: "error",
          message:
            payload.error ??
            `The Knowledge Brain could not answer. Server returned ${response.status}.`,
        });
        return;
      }

      setState({ status: "success", answer: payload.answer });
    } catch (error) {
      setState({
        status: "error",
        message:
          error instanceof Error
            ? `The Knowledge Brain could not answer before the request completed: ${error.message}`
            : "The Knowledge Brain could not answer before the request completed.",
      });
    }
  }

  return (
    <section className="grid gap-4 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
      <div className="rounded-md border border-zinc-200 bg-white p-5">
        <h2 className="text-lg font-semibold text-zinc-950">
          Ask the Knowledge Brain
        </h2>
        <p className="mt-2 text-sm text-zinc-600">
          Answers come from stored transcripts, expert takes, Trust Score,
          Expert Memory, consensus, and freshness-aware player intelligence.
        </p>

        <form className="mt-5 grid gap-4" onSubmit={handleSubmit}>
          <label className="grid gap-1 text-sm font-semibold text-zinc-700">
            Question
            <textarea
              className="min-h-28 rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950"
              onChange={(event) => setQuestion(event.target.value)}
              placeholder="What do experts think about Breece Hall?"
              value={question}
            />
          </label>

          <div className="grid gap-3 sm:grid-cols-[180px_minmax(0,1fr)]">
            <label className="grid gap-1 text-sm font-semibold text-zinc-700">
              Target Season
              <input
                className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950"
                inputMode="numeric"
                onChange={(event) => setTargetSeason(event.target.value)}
                value={targetSeason}
              />
            </label>
            <label className="flex items-end gap-2 rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm font-semibold text-zinc-700">
              <input
                checked={includeHistorical}
                className="h-4 w-4"
                onChange={(event) => setIncludeHistorical(event.target.checked)}
                type="checkbox"
              />
              Include historical transcripts
            </label>
          </div>

          <div>
            <p className="text-sm font-semibold text-zinc-700">Quick Prompts</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {QUICK_PROMPTS.map((prompt) => (
                <button
                  className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50"
                  key={prompt}
                  onClick={() => askQuestion(prompt)}
                  type="button"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>

          <button
            className="h-10 rounded-md bg-zinc-950 px-4 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-400 sm:w-fit"
            disabled={state.status === "loading"}
            type="submit"
          >
            {state.status === "loading" ? "Searching Brain" : "Ask"}
          </button>

          {state.status === "error" ? (
            <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-900">
              {state.message}
            </div>
          ) : null}
        </form>
      </div>

      <div className="grid gap-4">
        {state.status === "success" ? (
          <AnswerResult answer={state.answer} />
        ) : (
          <div className="rounded-md border border-zinc-200 bg-white p-5">
            <h2 className="text-lg font-semibold text-zinc-950">Answer</h2>
            <p className="mt-2 text-sm text-zinc-600">
              Ask a question or choose a quick prompt to search stored Knowledge
              Brain data. No YouTube, paid fantasy provider, or AI API call is
              made by this page.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}

function AnswerResult({ answer }: { answer: BrainSearchAnswer }) {
  return (
    <>
      <div className="rounded-md border border-zinc-200 bg-white p-5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-zinc-950">Answer</h2>
            <p className="mt-1 text-sm text-zinc-500">
              {formatQueryType(answer.queryType)} - {answer.filters.targetSeason}
              {answer.filters.includeHistorical ? " with historical content" : ""}
            </p>
          </div>
          <span className="rounded-md bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-800">
            Deterministic
          </span>
        </div>
        <p className="mt-4 text-sm leading-6 text-zinc-800">
          {answer.directAnswer}
        </p>
        {answer.limitedDataNote ? (
          <p className="mt-3 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            {answer.limitedDataNote}
          </p>
        ) : null}
        <p className="mt-3 text-xs text-zinc-500">{answer.ai.note}</p>
      </div>

      <ResultSection title="Relevant Players">
        {answer.relevantPlayers.length > 0 ? (
          <div className="grid gap-2">
            {answer.relevantPlayers.map((player) => (
              <Link
                className="rounded-md border border-zinc-200 bg-zinc-50 p-3 transition hover:border-emerald-200 hover:bg-emerald-50"
                href={`/knowledge-brain/players/${player.playerId}?targetSeason=${answer.filters.targetSeason}${answer.filters.includeHistorical ? "&includeHistorical=true" : ""}`}
                key={player.playerId}
              >
                <p className="font-semibold text-zinc-950">{player.fullName}</p>
                <p className="mt-1 text-sm text-zinc-600">
                  {player.position}
                  {player.team ? `, ${player.team}` : ""} -{" "}
                  {player.totalMentions} mention
                  {player.totalMentions === 1 ? "" : "s"},{" "}
                  {player.expertCount} expert
                  {player.expertCount === 1 ? "" : "s"}
                </p>
                <p className="mt-1 text-xs font-semibold text-zinc-600">
                  {player.bullishCount} bullish / {player.bearishCount} bearish
                  / {player.neutralCount} neutral - {player.intelligenceLabel} (
                  {player.intelligenceScore})
                </p>
              </Link>
            ))}
          </div>
        ) : (
          <EmptyState message="No relevant players found for this question." />
        )}
      </ResultSection>

      <ResultSection title="Trust Context">
        {answer.trustProfiles.length > 0 ? (
          <div className="grid gap-3">
            {answer.trustProfiles.map((profile) => (
              <Link
                className="rounded-md border border-zinc-200 bg-zinc-50 p-3 transition hover:border-emerald-200 hover:bg-emerald-50"
                href={`/knowledge-brain/players/${profile.playerId}?targetSeason=${answer.filters.targetSeason}${answer.filters.includeHistorical ? "&includeHistorical=true" : ""}`}
                key={profile.playerId}
              >
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="font-semibold text-zinc-950">
                      {profile.playerName}
                    </p>
                    <p className="mt-1 text-sm text-zinc-600">
                      {profile.position}
                      {profile.team ? `, ${profile.team}` : ""} -{" "}
                      {profile.stanceSummary}
                    </p>
                  </div>
                  <span className="rounded-md bg-white px-2 py-1 text-xs font-semibold text-zinc-700">
                    Trust {profile.trustScore} - {profile.confidenceLabel}
                  </span>
                </div>
                <p className="mt-2 text-sm text-zinc-600">
                  {profile.evidenceCount} evidence item
                  {profile.evidenceCount === 1 ? "" : "s"} - Expert Memory:{" "}
                  {profile.expertMemorySignal.label}
                </p>
                {profile.explanationBullets.length > 0 ? (
                  <ul className="mt-2 grid gap-1 text-sm text-zinc-600">
                    {profile.explanationBullets.slice(0, 2).map((bullet) => (
                      <li key={bullet}>{bullet}</li>
                    ))}
                  </ul>
                ) : null}
                {profile.warnings.length > 0 ? (
                  <p className="mt-2 rounded-md border border-amber-200 bg-amber-50 p-2 text-sm text-amber-950">
                    {profile.warnings[0]}
                  </p>
                ) : null}
              </Link>
            ))}
          </div>
        ) : (
          <EmptyState message="No Trust Profile matched this question yet." />
        )}
      </ResultSection>

      <ResultSection title="Expert Memory Signals">
        {answer.expertMemorySignals.length > 0 ? (
          <div className="grid gap-3">
            {answer.expertMemorySignals.map((memory) => (
              <div
                className="rounded-md border border-zinc-200 bg-zinc-50 p-3"
                key={`${memory.playerId}-${memory.expertName}-${memory.opinionTrend}`}
              >
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="font-semibold text-zinc-950">
                      {memory.playerName}
                    </p>
                    <p className="mt-1 text-sm text-zinc-600">
                      {memory.expertName} - {formatEnumLabel(memory.currentStance)}
                    </p>
                  </div>
                  <span className="rounded-md bg-white px-2 py-1 text-xs font-semibold text-zinc-700">
                    {memory.convictionLabel} {memory.convictionScore}
                  </span>
                </div>
                <p className="mt-2 text-sm font-semibold text-zinc-800">
                  {memory.opinionTrend}
                </p>
                {memory.latestSummary ? (
                  <p className="mt-1 text-sm text-zinc-600">
                    {memory.latestSummary}
                  </p>
                ) : null}
              </div>
            ))}
          </div>
        ) : (
          <EmptyState message="No Expert Memory signal matched this question yet." />
        )}
      </ResultSection>

      <ResultSection title="Consensus / Weighted Consensus">
        {answer.consensusRows.length > 0 || answer.weightedConsensusRows.length > 0 ? (
          <div className="grid gap-3">
            {answer.consensusRows.map((row) => (
              <div
                className="rounded-md border border-zinc-200 bg-zinc-50 p-3"
                key={`raw-${row.playerId}`}
              >
                <p className="font-semibold text-zinc-950">
                  {row.playerName} - {row.consensusLabel}
                </p>
                <p className="mt-1 text-sm text-zinc-600">
                  {row.totalExperts} expert
                  {row.totalExperts === 1 ? "" : "s"} - {row.bullishExperts}{" "}
                  bullish / {row.bearishExperts} bearish / {row.neutralExperts}{" "}
                  neutral - agreement {row.agreementScore}%
                </p>
              </div>
            ))}
            {answer.weightedConsensusRows.map((row) => (
              <div
                className="rounded-md border border-zinc-200 bg-zinc-50 p-3"
                key={`weighted-${row.playerId}`}
              >
                <p className="font-semibold text-zinc-950">
                  {row.playerName} - {row.weightedConsensusLabel}
                </p>
                <p className="mt-1 text-sm text-zinc-600">
                  Raw: {row.rawConsensusLabel} - weighted scores B{" "}
                  {row.weightedBullishScore}, N {row.weightedNeutralScore}, D{" "}
                  {row.weightedBearishScore} - confidence{" "}
                  {row.trustWeightedConfidence}%
                </p>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState message="No consensus rows matched this question." />
        )}
      </ResultSection>

      <ResultSection title="Supporting Evidence">
        {answer.topExpertTakes.length > 0 ? (
          <div className="grid gap-3">
            {answer.topExpertTakes.map((take) => (
              <div
                className="rounded-md border border-zinc-200 bg-zinc-50 p-3"
                key={take.id}
              >
                <p className="text-xs font-semibold uppercase text-zinc-500">
                  {take.expertName} - {formatEnumLabel(take.sentiment)} -{" "}
                  {formatEnumLabel(take.takeType)}
                </p>
                <p className="mt-1 font-semibold text-zinc-950">
                  {take.playerName ? `${take.playerName}: ` : ""}
                  {take.summary}
                </p>
                <p className="mt-1 text-sm text-zinc-600">{take.excerpt}</p>
                <p className="mt-2 text-xs text-zinc-500">
                  {take.sourceTitle} - {formatDate(take.publishDate)} -{" "}
                  {formatEnumLabel(take.freshnessLabel)}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState message="No supporting expert takes found." />
        )}
      </ResultSection>

      <ResultSection title="Source References">
        {answer.citations.length > 0 ? (
          <div className="grid gap-2">
            {answer.citations.map((citation) => (
              <div
                className="rounded-md border border-zinc-200 bg-zinc-50 p-3 text-sm"
                key={`${citation.expertName}-${citation.sourceTitle}-${citation.publishDate}`}
              >
                <p className="font-semibold text-zinc-950">
                  {citation.expertName}
                </p>
                {citation.sourceUrl ? (
                  <a
                    className="text-emerald-700 hover:text-emerald-900"
                    href={citation.sourceUrl}
                    rel="noreferrer"
                    target="_blank"
                  >
                    {citation.sourceTitle}
                  </a>
                ) : (
                  <p className="text-zinc-700">{citation.sourceTitle}</p>
                )}
                <p className="mt-1 text-xs text-zinc-500">
                  {formatDate(citation.publishDate)} -{" "}
                  {formatEnumLabel(citation.freshnessLabel)}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState message="No source references found." />
        )}
      </ResultSection>
    </>
  );
}

function ResultSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-md border border-zinc-200 bg-white p-5">
      <h2 className="text-lg font-semibold text-zinc-950">{title}</h2>
      <div className="mt-4">{children}</div>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <p className="rounded-md border border-dashed border-zinc-300 bg-zinc-50 p-3 text-sm text-zinc-500">
      {message}
    </p>
  );
}

function formatQueryType(value: string) {
  return formatEnumLabel(value.replace(/^PLAYER_/, ""));
}

function formatEnumLabel(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatDate(value: string | null) {
  if (!value) return "No publish date";

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

async function readJsonResponse(response: Response) {
  const text = await response.text();

  if (!text) return {};

  try {
    return JSON.parse(text);
  } catch {
    return {
      error: `Server returned a non-JSON response: ${text.slice(0, 160)}`,
    };
  }
}
