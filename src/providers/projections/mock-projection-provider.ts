import type {
  PlayerProjection,
  ProjectionProvider,
  ProjectionStats,
} from "@/domain/fantasy";

export interface MockProjectionPlayer {
  id: string;
  position: string;
  team?: string | null;
  active: boolean;
}

export interface MockProjectionInput {
  season: number;
  week: number;
  players: MockProjectionPlayer[];
}

type ProjectionShape = {
  medianMin: number;
  medianMax: number;
  volatility: number;
};

const POSITION_SHAPES: Record<string, ProjectionShape> = {
  QB: { medianMin: 15.5, medianMax: 25.5, volatility: 5.5 },
  RB: { medianMin: 7.5, medianMax: 18.5, volatility: 6 },
  WR: { medianMin: 7, medianMax: 17.5, volatility: 5.8 },
  TE: { medianMin: 4.5, medianMax: 13, volatility: 4.5 },
  K: { medianMin: 5.5, medianMax: 10.5, volatility: 3 },
  DST: { medianMin: 5, medianMax: 11.5, volatility: 4 },
  DEF: { medianMin: 5, medianMax: 11.5, volatility: 4 },
  IDP: { medianMin: 4, medianMax: 10, volatility: 4 },
};

export class MockProjectionProvider implements ProjectionProvider {
  readonly name = "MOCK" as const;

  async getPlayerProjections(...args: unknown[]): Promise<PlayerProjection[]> {
    const input = parseMockProjectionInput(args[0]);
    const sourceTimestamp = new Date().toISOString();

    return input.players.map((player) =>
      buildProjection(player, input.season, input.week, sourceTimestamp),
    );
  }
}

function parseMockProjectionInput(value: unknown): MockProjectionInput {
  if (!value || typeof value !== "object") {
    throw new Error("MockProjectionProvider requires a projection input object.");
  }

  const input = value as Partial<MockProjectionInput>;

  if (!Number.isInteger(input.season)) {
    throw new Error("MockProjectionProvider requires a season.");
  }

  if (!Number.isInteger(input.week)) {
    throw new Error("MockProjectionProvider requires a week.");
  }

  if (!Array.isArray(input.players)) {
    throw new Error("MockProjectionProvider requires players.");
  }

  return input as MockProjectionInput;
}

function buildProjection(
  player: MockProjectionPlayer,
  season: number,
  week: number,
  sourceTimestamp: string,
): PlayerProjection {
  const position = player.position.toUpperCase();
  const shape = POSITION_SHAPES[position] ?? {
    medianMin: 3,
    medianMax: 9,
    volatility: 3.5,
  };
  const seed = seededNumber(`${player.id}:${season}:${week}`);
  const median = round(
    shape.medianMin + seed * (shape.medianMax - shape.medianMin),
  );
  const activeMultiplier = player.active ? 1 : 0.2;
  const adjustedMedian = round(median * activeMultiplier);
  const floor = round(Math.max(0, adjustedMedian - shape.volatility * 0.65));
  const ceiling = round(adjustedMedian + shape.volatility * 0.95);
  const confidence = round(0.58 + seededNumber(`${player.id}:confidence`) * 0.28);

  return {
    playerId: player.id,
    season,
    week,
    projectedStats: buildProjectedStats(position, adjustedMedian),
    projectedFantasyPoints: adjustedMedian,
    floor,
    median: adjustedMedian,
    ceiling,
    confidence,
    source: {
      provider: "MOCK",
      sourceTimestamp,
    },
  };
}

function buildProjectedStats(position: string, points: number): ProjectionStats {
  if (position === "QB") {
    return {
      pass_yd: round(points * 12),
      pass_td: round(points / 7),
      pass_int: round(points / 20),
      rush_yd: round(points * 0.8),
    };
  }

  if (position === "RB") {
    return {
      rush_yd: round(points * 5.2),
      rush_td: round(points / 14),
      rec: round(points / 5),
      rec_yd: round(points * 1.5),
    };
  }

  if (position === "WR" || position === "TE") {
    return {
      rec: round(points / 2.8),
      rec_yd: round(points * 6.4),
      rec_td: round(points / 15),
    };
  }

  if (position === "K") {
    return {
      fg: round(points / 3),
      xp: round(points / 4),
    };
  }

  return {
    fantasy_points_basis: points,
  };
}

function seededNumber(seed: string) {
  let hash = 0;

  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) >>> 0;
  }

  return (hash % 10000) / 10000;
}

function round(value: number) {
  return Math.round(value * 100) / 100;
}
