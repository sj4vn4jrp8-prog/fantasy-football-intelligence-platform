import type { ScoredProjection, ScoringInput } from "@/types/scoring";

export function calculateFantasyPoints({
  projectedStats,
  rules,
  position,
}: ScoringInput): ScoredProjection {
  const stats = normalizeProjectedStats(projectedStats);
  const appliedRules = rules
    .filter(
      (rule) =>
        !rule.position || rule.position === "ALL" || rule.position === position,
    )
    .map((rule) => {
      const statValue = stats[rule.statKey] ?? 0;
      const total = statValue * rule.points;

      return {
        statKey: rule.statKey,
        statValue,
        pointsPerUnit: rule.points,
        total,
      };
    })
    .filter((rule) => rule.statValue !== 0);

  const fantasyPoints = appliedRules.reduce((sum, rule) => sum + rule.total, 0);

  return {
    fantasyPoints: roundFantasyPoints(fantasyPoints),
    appliedRules,
  };
}

function normalizeProjectedStats(projectedStats: unknown) {
  if (!projectedStats || typeof projectedStats !== "object") {
    return {};
  }

  if (Array.isArray(projectedStats)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(projectedStats)
      .map(([statKey, value]) => [statKey, Number(value)])
      .filter(([, value]) => Number.isFinite(value)),
  );
}

function roundFantasyPoints(points: number) {
  return Math.round(points * 100) / 100;
}
