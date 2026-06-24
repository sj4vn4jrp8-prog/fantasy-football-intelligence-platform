import type { ProjectionProvider } from "@/domain/fantasy";

export interface FantasyProsProviderConfig {
  apiKey?: string;
  baseUrl?: string;
}

export type FantasyProsPosition = "QB" | "RB" | "WR" | "TE" | "K" | "DST";

export interface FantasyProsProjectionRequest {
  season: number;
  week: number;
  positions?: FantasyProsPosition[];
}

export interface FantasyProsProjectionRow {
  fantasyProsPlayerId?: string;
  playerName: string;
  firstName?: string;
  lastName?: string;
  position: FantasyProsPosition | string;
  team?: string;
  projectedStats: Record<string, number>;
  projectedFantasyPoints?: number;
  floor?: number;
  median?: number;
  ceiling?: number;
  confidence?: number;
  sourceTimestamp: string;
  raw: Record<string, unknown>;
}

export interface FantasyProsAuthDiagnostic {
  authStyleAttempted: "x-api-key header";
  ok: boolean;
  targetUrl: string;
  httpStatus: number | null;
  responseSnippet?: string;
  errorMessage?: string;
  projectionEndpointPreview: string;
}

export class FantasyProsConfigurationError extends Error {
  constructor() {
    super("FANTASYPROS_API_KEY is required to import FantasyPros projections.");
    this.name = "FantasyProsConfigurationError";
  }
}

export class FantasyProsUnauthorizedError extends Error {
  constructor() {
    super("FantasyPros rejected the configured API key.");
    this.name = "FantasyProsUnauthorizedError";
  }
}

export class FantasyProsApiUnavailableError extends Error {
  constructor(message = "FantasyPros projections are temporarily unavailable.") {
    super(message);
    this.name = "FantasyProsApiUnavailableError";
  }
}

export class FantasyProsNoProjectionsError extends Error {
  constructor() {
    super("FantasyPros returned no projection rows for the requested week.");
    this.name = "FantasyProsNoProjectionsError";
  }
}

const DEFAULT_FANTASYPROS_BASE_URL =
  "https://api.fantasypros.com/v2/json/nfl";
const FANTASYPROS_AUTH_STYLE = "x-api-key header" as const;
const DEFAULT_POSITIONS: FantasyProsPosition[] = [
  "QB",
  "RB",
  "WR",
  "TE",
  "K",
  "DST",
];

export class FantasyProsProvider implements ProjectionProvider {
  readonly name = "FANTASYPROS" as const;

  constructor(private readonly config: FantasyProsProviderConfig = {}) {}

  isConfigured() {
    return Boolean(this.config.apiKey?.trim());
  }

  getStatus() {
    return {
      configured: this.isConfigured(),
      baseUrlConfigured: Boolean(this.config.baseUrl?.trim()),
    };
  }

  async getPlayerProjections(
    ...args: unknown[]
  ): Promise<FantasyProsProjectionRow[]> {
    if (!this.isConfigured()) {
      throw new FantasyProsConfigurationError();
    }

    const input = parseFantasyProsProjectionRequest(args[0]);
    const projectionRows: FantasyProsProjectionRow[] = [];

    for (const position of input.positions ?? DEFAULT_POSITIONS) {
      const payload = await this.fetchProjectionPayload(input, position);
      const rows = extractProjectionRows(payload)
        .map((row) => normalizeProjectionRow(row, position))
        .filter((row): row is FantasyProsProjectionRow => Boolean(row));

      projectionRows.push(...rows);
    }

    if (projectionRows.length === 0) {
      throw new FantasyProsNoProjectionsError();
    }

    return projectionRows;
  }

  async testAuthentication(): Promise<FantasyProsAuthDiagnostic> {
    const targetUrl = buildPlayersUrl(this.config);
    const projectionEndpointPreview = buildProjectionUrl(this.config, {
      season: new Date().getFullYear(),
      week: 1,
    }, "QB").toString();

    if (!this.isConfigured()) {
      return {
        authStyleAttempted: FANTASYPROS_AUTH_STYLE,
        ok: false,
        targetUrl: redactFantasyProsUrl(targetUrl.toString()),
        httpStatus: null,
        responseSnippet: "FANTASYPROS_API_KEY is not configured.",
        projectionEndpointPreview: redactFantasyProsUrl(projectionEndpointPreview),
      };
    }

    try {
      const response = await fetch(targetUrl, {
        cache: "no-store",
        headers: {
          Accept: "application/json",
          "x-api-key": this.config.apiKey?.trim() ?? "",
        },
      });
      const responseText = await response.text().catch(() => "");

      return {
        authStyleAttempted: FANTASYPROS_AUTH_STYLE,
        ok: response.ok,
        targetUrl: redactFantasyProsUrl(targetUrl.toString()),
        httpStatus: response.status,
        responseSnippet: getSafeSnippet(responseText),
        projectionEndpointPreview: redactFantasyProsUrl(projectionEndpointPreview),
      };
    } catch (error) {
      return {
        authStyleAttempted: FANTASYPROS_AUTH_STYLE,
        ok: false,
        targetUrl: redactFantasyProsUrl(targetUrl.toString()),
        httpStatus: null,
        errorMessage: getSafeSnippet(getErrorMessage(error)),
        projectionEndpointPreview: redactFantasyProsUrl(projectionEndpointPreview),
      };
    }
  }

  private async fetchProjectionPayload(
    input: FantasyProsProjectionRequest,
    position: FantasyProsPosition,
  ) {
    const response = await fetch(buildProjectionUrl(this.config, input, position), {
      cache: "no-store",
      headers: {
        Accept: "application/json",
        "x-api-key": this.config.apiKey?.trim() ?? "",
      },
    }).catch((error: unknown) => {
      throw new FantasyProsApiUnavailableError(getErrorMessage(error));
    });

    if (response.status === 401 || response.status === 403) {
      throw new FantasyProsUnauthorizedError();
    }

    if (!response.ok) {
      throw new FantasyProsApiUnavailableError(
        `FantasyPros returned HTTP ${response.status}.`,
      );
    }

    return response.json().catch(() => {
      throw new FantasyProsApiUnavailableError(
        "FantasyPros returned a response that was not valid JSON.",
      );
    });
  }
}

function buildProjectionUrl(
  config: FantasyProsProviderConfig,
  input: FantasyProsProjectionRequest,
  position: FantasyProsPosition,
) {
  const baseUrl = (config.baseUrl?.trim() || DEFAULT_FANTASYPROS_BASE_URL)
    .replace("{season}", String(input.season))
    .replace("{week}", String(input.week))
    .replace("{position}", position);
  const hasTemplate = baseUrl !== (config.baseUrl?.trim() || DEFAULT_FANTASYPROS_BASE_URL);
  const url = new URL(
    hasTemplate
      ? baseUrl
      : `${baseUrl.replace(/\/$/, "")}/${input.season}/projections`,
  );

  if (!url.searchParams.has("week")) {
    url.searchParams.set("week", String(input.week));
  }

  if (!url.searchParams.has("position")) {
    url.searchParams.set("position", position);
  }

  return url;
}

function buildPlayersUrl(config: FantasyProsProviderConfig) {
  const configuredBaseUrl = config.baseUrl?.trim();

  if (
    !configuredBaseUrl ||
    configuredBaseUrl.includes("{") ||
    configuredBaseUrl.includes("/projections")
  ) {
    return new URL(`${DEFAULT_FANTASYPROS_BASE_URL}/players`);
  }

  const baseUrl = configuredBaseUrl.replace(/\/$/, "");

  if (baseUrl.endsWith("/players")) {
    return new URL(baseUrl);
  }

  return new URL(`${baseUrl}/players`);
}

function parseFantasyProsProjectionRequest(
  value: unknown,
): FantasyProsProjectionRequest {
  if (!value || typeof value !== "object") {
    throw new Error("FantasyProsProvider requires a projection input object.");
  }

  const input = value as Partial<FantasyProsProjectionRequest>;
  const season = input.season;
  const week = input.week;

  if (typeof season !== "number" || !Number.isInteger(season)) {
    throw new Error("FantasyProsProvider requires a season.");
  }

  if (typeof week !== "number" || !Number.isInteger(week)) {
    throw new Error("FantasyProsProvider requires a week.");
  }

  return {
    season,
    week,
    positions: Array.isArray(input.positions)
      ? input.positions.filter(isFantasyProsPosition)
      : undefined,
  };
}

function isFantasyProsPosition(value: string): value is FantasyProsPosition {
  return DEFAULT_POSITIONS.includes(value as FantasyProsPosition);
}

function extractProjectionRows(payload: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(payload)) {
    return payload.filter(isRecord);
  }

  if (!isRecord(payload)) {
    return [];
  }

  const candidateKeys = [
    "players",
    "projections",
    "results",
    "data",
    "items",
    "body",
  ];

  for (const key of candidateKeys) {
    const value = payload[key];

    if (Array.isArray(value)) {
      return value.filter(isRecord);
    }

    const nestedRows = extractProjectionRows(value);

    if (nestedRows.length > 0) {
      return nestedRows;
    }
  }

  for (const value of Object.values(payload)) {
    const nestedRows = extractProjectionRows(value);

    if (nestedRows.length > 0) {
      return nestedRows;
    }
  }

  return [];
}

function normalizeProjectionRow(
  row: Record<string, unknown>,
  fallbackPosition: FantasyProsPosition,
): FantasyProsProjectionRow | undefined {
  const playerName = getString(row, [
    "player_name",
    "playerName",
    "full_name",
    "fullName",
    "name",
    "player",
  ]);

  if (!playerName) return undefined;

  const position = getString(row, ["position", "pos"]) ?? fallbackPosition;
  const projectedStats = normalizeProjectedStats(row);
  const projectedFantasyPoints = getNumber(row, [
    "fpts",
    "fantasy_points",
    "fantasyPoints",
    "projected_fantasy_points",
    "projectedFantasyPoints",
    "points",
    "proj",
  ]);

  return {
    fantasyProsPlayerId: getString(row, [
      "player_id",
      "playerId",
      "fantasypros_id",
      "fantasyProsId",
      "fp_player_id",
      "id",
    ]),
    playerName,
    firstName: getString(row, ["first_name", "firstName"]),
    lastName: getString(row, ["last_name", "lastName"]),
    position,
    team: normalizeTeam(getString(row, ["team", "team_id", "player_team_id"])),
    projectedStats,
    projectedFantasyPoints,
    floor: getNumber(row, ["floor", "low"]),
    median: getNumber(row, ["median"]) ?? projectedFantasyPoints,
    ceiling: getNumber(row, ["ceiling", "high"]),
    confidence: normalizeConfidence(getNumber(row, ["confidence"])),
    sourceTimestamp: new Date().toISOString(),
    raw: row,
  };
}

function normalizeProjectedStats(row: Record<string, unknown>) {
  const flattened = flattenRecord(row);
  const stats: Record<string, number> = {};

  for (const [statKey, aliases] of Object.entries(STAT_ALIASES)) {
    const value = getNumber(flattened, aliases);

    if (value !== undefined) {
      stats[statKey] = value;
    }
  }

  return stats;
}

const STAT_ALIASES: Record<string, string[]> = {
  pass_yd: [
    "pass_yd",
    "pass_yds",
    "pass_yards",
    "passing_yds",
    "passing_yards",
  ],
  pass_td: [
    "pass_td",
    "pass_tds",
    "pass_touchdowns",
    "passing_tds",
    "passing_touchdowns",
  ],
  pass_int: [
    "pass_int",
    "pass_ints",
    "int",
    "ints",
    "interceptions",
    "passing_interceptions",
  ],
  rush_yd: [
    "rush_yd",
    "rush_yds",
    "rush_yards",
    "rushing_yds",
    "rushing_yards",
  ],
  rush_td: [
    "rush_td",
    "rush_tds",
    "rush_touchdowns",
    "rushing_tds",
    "rushing_touchdowns",
  ],
  rec: ["rec", "receptions", "receiving_receptions"],
  rec_yd: ["rec_yd", "rec_yds", "rec_yards", "receiving_yds"],
  rec_td: ["rec_td", "rec_tds", "rec_touchdowns", "receiving_tds"],
  fum_lost: ["fum_lost", "fumbles_lost", "lost_fumbles"],
  fg: ["fg", "field_goals", "field_goals_made"],
  xp: ["xp", "extra_points", "extra_points_made"],
};

function flattenRecord(value: Record<string, unknown>) {
  const flattened: Record<string, unknown> = {};

  for (const [key, item] of Object.entries(value)) {
    flattened[normalizeKey(key)] = item;

    if (isRecord(item)) {
      for (const [nestedKey, nestedValue] of Object.entries(item)) {
        flattened[normalizeKey(nestedKey)] = nestedValue;
      }
    }
  }

  return flattened;
}

function getString(row: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = row[normalizeKey(key)] ?? row[key];

    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }

    if (typeof value === "number" && Number.isFinite(value)) {
      return String(value);
    }
  }

  return undefined;
}

function getNumber(row: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = row[normalizeKey(key)] ?? row[key];

    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }

    if (typeof value === "string") {
      const parsed = Number(value.replace(/,/g, ""));

      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
  }

  return undefined;
}

function normalizeConfidence(value?: number) {
  if (typeof value !== "number") return undefined;

  return value > 1 ? Math.min(1, Math.max(0, value / 100)) : value;
}

function normalizeTeam(value?: string) {
  if (!value) return undefined;

  const normalized = value.trim().toUpperCase();

  if (!normalized || normalized === "FA") return undefined;
  if (normalized === "JAC") return "JAX";
  if (normalized === "WAS") return "WSH";

  return normalized;
}

function normalizeKey(value: string) {
  return value.replace(/([a-z])([A-Z])/g, "$1_$2").toLowerCase();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function getSafeSnippet(value: string) {
  return redactFantasyProsUrl(value).slice(0, 500);
}

function redactFantasyProsUrl(value: string) {
  return value
    .replace(/(x-api-key[=:]\s*)[^\s"',}]+/gi, "$1[REDACTED]")
    .replace(/([?&](?:api_key|apikey|key)=)[^&\s"']+/gi, "$1[REDACTED]");
}
