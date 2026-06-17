import type { OptimizedLineupPlayer } from "@/analysis/optimizer/optimizeLineup";

export function explainStarterRecommendation(player: OptimizedLineupPlayer) {
  const name = player.player.fullName;
  const slot = player.slot.label;
  const points = player.adjustedPoints.toFixed(1);
  const factors = [
    `${name} fits the ${slot} slot`,
    `${points} adjusted projected points`,
  ];

  if (player.injuryStatus) {
    factors.push(`injury status: ${player.injuryStatus}`);
  }

  if (player.matchupAdjustment) {
    factors.push(`matchup adjustment: ${player.matchupAdjustment.toFixed(1)}`);
  }

  if (player.playoffBoost) {
    factors.push(`playoff schedule boost: ${player.playoffBoost.toFixed(1)}`);
  }

  return factors.join("; ");
}
