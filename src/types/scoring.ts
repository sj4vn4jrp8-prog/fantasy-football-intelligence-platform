import type { LeagueScoringRule, Position } from "./fantasy";

export interface ScoringInput {
  projectedStats: unknown;
  rules: LeagueScoringRule[];
  position?: Position | string;
}

export interface ScoredProjection {
  fantasyPoints: number;
  appliedRules: Array<{
    statKey: string;
    statValue: number;
    pointsPerUnit: number;
    total: number;
  }>;
}
