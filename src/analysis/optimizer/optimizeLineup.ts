import {
  buildLineupSlots,
  type LineupSlot,
  type RosterSettingsInput,
} from "./rosterConstraints";
import type { ProjectionMode } from "@/analysis/projections/selectProjection";

export interface OptimizerPlayer {
  id: string;
  firstName?: string | null;
  lastName?: string | null;
  fullName: string;
  position: string;
  team?: string | null;
  active?: boolean;
}

export interface OptimizerCandidate {
  player: OptimizerPlayer;
  projectedPoints: number;
  projectedFloor?: number | null;
  projectedCeiling?: number | null;
  confidence?: number | null;
  hasProjection?: boolean;
  rawProjectedPoints?: number | null;
  projectionMode?: ProjectionMode;
  projectionSpread?: number | null;
  providerAgreementScore?: number | null;
  providerCount?: number | null;
  limitedBySingleProvider?: boolean;
  projection?: {
    projectedFantasyPoints?: number | null;
    median?: number | null;
    floor?: number | null;
    ceiling?: number | null;
    confidence?: number | null;
  };
  injuryStatus?: string;
  isByeWeek?: boolean;
  matchupAdjustment?: number;
  scarcityBonus?: number;
  playoffBoost?: number;
}

export interface OptimizedLineupPlayer extends OptimizerCandidate {
  slot: LineupSlot;
  adjustedPoints: number;
}

export type ScoredOptimizerCandidate = OptimizerCandidate & {
  adjustedPoints: number;
};

export interface LineupOptimizationResult {
  starters: OptimizedLineupPlayer[];
  bench: ScoredOptimizerCandidate[];
  projectedTotal: number;
  explanation: string;
}

export function optimizeLineup(
  candidates: OptimizerCandidate[],
  settings?: RosterSettingsInput | null,
): LineupOptimizationResult {
  const slots = buildLineupSlots(settings);
  const scoredCandidates = candidates
    .map((candidate) => ({
      ...candidate,
      adjustedPoints: calculateAdjustedPoints(candidate),
    }))
    .sort(compareScoredCandidates);

  const usedPlayerIds = new Set<string>();
  const starters: OptimizedLineupPlayer[] = [];

  for (const slot of slots) {
    const candidate = scoredCandidates.find(
      (player) =>
        !usedPlayerIds.has(player.player.id) &&
        isEligibleForSlot(slot, player.player.position),
    );

    if (!candidate) continue;

    usedPlayerIds.add(candidate.player.id);
    starters.push({ ...candidate, slot });
  }

  const bench = scoredCandidates.filter(
    (candidate) => !usedPlayerIds.has(candidate.player.id),
  );

  return {
    starters,
    bench,
    projectedTotal: round(
      starters.reduce((sum, player) => sum + player.adjustedPoints, 0),
    ),
    explanation: buildLineupExplanation(starters, bench, slots.length),
  };
}

function calculateAdjustedPoints(candidate: OptimizerCandidate) {
  const base = getBaseProjectedPoints(candidate);
  const injuryMultiplier = getInjuryMultiplier(candidate.injuryStatus);
  const byeMultiplier = candidate.isByeWeek ? 0 : 1;
  const contextAdjustment =
    (candidate.matchupAdjustment ?? 0) +
    (candidate.scarcityBonus ?? 0) +
    (candidate.playoffBoost ?? 0);

  return round((base + contextAdjustment) * injuryMultiplier * byeMultiplier);
}

function getBaseProjectedPoints(candidate: OptimizerCandidate) {
  if (Number.isFinite(candidate.projectedPoints)) {
    return candidate.projectedPoints;
  }

  return (
    candidate.projection?.projectedFantasyPoints ??
    candidate.projection?.median ??
    0
  );
}

function getInjuryMultiplier(status?: string) {
  if (!status) return 1;

  const normalized = status.toLowerCase();
  if (normalized.includes("out") || normalized.includes("ir")) return 0;
  if (normalized.includes("doubtful")) return 0.25;
  if (normalized.includes("questionable")) return 0.8;

  return 1;
}

function isEligibleForSlot(slot: LineupSlot, position: string) {
  return slot.eligiblePositions
    .map((eligiblePosition) => normalizePosition(eligiblePosition))
    .includes(normalizePosition(position));
}

function normalizePosition(position: string) {
  const normalized = position.trim().toUpperCase();

  if (normalized === "DEF" || normalized === "D/ST") return "DST";
  if (normalized === "PK") return "K";

  return normalized;
}

function compareScoredCandidates(
  playerA: ScoredOptimizerCandidate,
  playerB: ScoredOptimizerCandidate,
) {
  return (
    playerB.adjustedPoints - playerA.adjustedPoints ||
    playerA.player.position.localeCompare(playerB.player.position) ||
    getPlayerName(playerA.player).localeCompare(getPlayerName(playerB.player)) ||
    playerA.player.id.localeCompare(playerB.player.id)
  );
}

function buildLineupExplanation(
  starters: OptimizedLineupPlayer[],
  bench: ScoredOptimizerCandidate[],
  slotCount: number,
) {
  if (starters.length === 0 && bench.length === 0) {
    return "No rostered players were available for this team yet.";
  }

  if (slotCount === 0) {
    return "No starter slots were available from the imported roster settings, so every rostered player is listed as bench.";
  }

  if (starters.length === 0) {
    return "No rostered player matched the available starter slots.";
  }

  const startersByMargin = [...starters].sort(
    (playerA, playerB) =>
      playerA.adjustedPoints - playerB.adjustedPoints ||
      getPlayerName(playerA.player).localeCompare(getPlayerName(playerB.player)),
  );

  for (const starter of startersByMargin) {
    const benchOption = bench
      .filter((candidate) =>
        isEligibleForSlot(starter.slot, candidate.player.position),
      )
      .sort(compareScoredCandidates)[0];

    if (!benchOption) continue;

    const starterName = getPlayerName(starter.player);
    const benchName = getPlayerName(benchOption.player);
    const difference = round(starter.adjustedPoints - benchOption.adjustedPoints);

    if (difference <= 0) {
      return `Started ${starterName} over ${benchName} because ${starterName} won the deterministic slot tiebreaker.`;
    }

    return `Started ${starterName} over ${benchName} because ${starterName} projects ${difference.toFixed(
      1,
    )} points higher.`;
  }

  return "The recommended starters fill the available roster slots with the highest league-adjusted projections.";
}

function getPlayerName(player: OptimizerPlayer) {
  const fullName = sanitizeNamePart(player.fullName);

  if (fullName) return fullName;

  const firstLast = [player.firstName, player.lastName]
    .map(sanitizeNamePart)
    .filter(Boolean)
    .join(" ");

  return firstLast || player.id;
}

function sanitizeNamePart(value?: string | null) {
  if (!value) return undefined;

  const trimmed = value.trim();

  if (!trimmed || trimmed.toLowerCase() === "unknown") {
    return undefined;
  }

  return trimmed;
}

function round(value: number) {
  return Math.round(value * 100) / 100;
}
