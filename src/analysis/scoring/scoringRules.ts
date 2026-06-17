import type { LeagueScoringRule } from "@/domain/fantasy";

export const standardScoringRules: LeagueScoringRule[] = [
  {
    statKey: "pass_yd",
    points: 0.04,
    position: "ALL",
    description: "Passing yards",
  },
  {
    statKey: "pass_td",
    points: 4,
    position: "ALL",
    description: "Passing touchdowns",
  },
  {
    statKey: "pass_int",
    points: -2,
    position: "ALL",
    description: "Interceptions thrown",
  },
  {
    statKey: "rush_yd",
    points: 0.1,
    position: "ALL",
    description: "Rushing yards",
  },
  {
    statKey: "rush_td",
    points: 6,
    position: "ALL",
    description: "Rushing touchdowns",
  },
  {
    statKey: "rec_yd",
    points: 0.1,
    position: "ALL",
    description: "Receiving yards",
  },
  {
    statKey: "rec_td",
    points: 6,
    position: "ALL",
    description: "Receiving touchdowns",
  },
  {
    statKey: "fum_lost",
    points: -2,
    position: "ALL",
    description: "Fumbles lost",
  },
];

export const halfPprScoringRules: LeagueScoringRule[] = [
  ...standardScoringRules,
  {
    statKey: "rec",
    points: 0.5,
    position: "ALL",
    description: "Receptions",
  },
];

export const pprScoringRules: LeagueScoringRule[] = [
  ...standardScoringRules,
  {
    statKey: "rec",
    points: 1,
    position: "ALL",
    description: "Receptions",
  },
];
