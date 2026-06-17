import { NextRequest, NextResponse } from "next/server";
import { saveLeagueImport } from "@/lib/league-import";
import { SleeperAdapter } from "@/platforms/sleeper/sleeper-adapter";
import {
  SleeperApiError,
  SleeperLeagueNotFoundError,
} from "@/platforms/sleeper/sleeper-client";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const leagueId = typeof body?.leagueId === "string" ? body.leagueId.trim() : "";
  const week = Number(body?.week ?? 1);

  if (!leagueId) {
    return NextResponse.json(
      { error: "leagueId is required" },
      { status: 400 },
    );
  }

  if (!/^\d+$/.test(leagueId)) {
    return NextResponse.json(
      { error: "Enter a valid Sleeper league ID. It should be numbers only." },
      { status: 400 },
    );
  }

  if (!Number.isInteger(week) || week < 1 || week > 18) {
    return NextResponse.json(
      { error: "Enter a valid NFL week between 1 and 18." },
      { status: 400 },
    );
  }

  try {
    const sleeper = new SleeperAdapter();
    const settings = await sleeper.getSettings(leagueId);
    const warnings: string[] = [];
    const [rosters, matchups] = await Promise.all([
      sleeper.getRosters(leagueId),
      sleeper.getMatchups(leagueId, week),
    ]);
    const importedPlayerIds = collectImportedPlayerIds(rosters, matchups);
    const players =
      importedPlayerIds.size > 0
        ? await getImportedSleeperPlayers(sleeper, importedPlayerIds, warnings)
        : [];
    const summary = await saveLeagueImport({
      settings,
      rosters,
      players,
      matchups,
      requestedWeek: week,
      warnings,
    });

    return NextResponse.json({ summary });
  } catch (error) {
    if (error instanceof SleeperLeagueNotFoundError) {
      return NextResponse.json(
        { error: "That Sleeper league ID was not found." },
        { status: 404 },
      );
    }

    if (error instanceof SleeperApiError) {
      return NextResponse.json(
        { error: "Sleeper is unavailable right now. Please try again shortly." },
        { status: 503 },
      );
    }

    const details = getSafeErrorDetails(error);

    console.error(
      "Sleeper import database save failed",
      JSON.stringify({
        leagueId,
        week,
        error: details,
      }),
    );

    return NextResponse.json(
      {
        error:
          "The league was fetched, but saving it to the database failed. Check the server logs for the exact Prisma/database error.",
        ...(isDevelopment() ? { details } : {}),
      },
      { status: 500 },
    );
  }
}

async function getImportedSleeperPlayers(
  sleeper: SleeperAdapter,
  importedPlayerIds: Set<string>,
  warnings: string[],
) {
  try {
    return await sleeper.getPlayersByIds(importedPlayerIds);
  } catch (error) {
    warnings.push(
      "Player names were unavailable from Sleeper, so player IDs were used as fallbacks.",
    );
    console.error(
      "Sleeper player metadata fetch failed during import",
      JSON.stringify({ error: getSafeErrorDetails(error) }),
    );

    return [];
  }
}

function collectImportedPlayerIds(
  rosters: Array<{
    players?: Array<{ playerId?: string }>;
  }>,
  matchups: Array<{
    teams?: Array<{
      players?: string[];
      starters?: string[];
    }>;
  }>,
) {
  const playerIds = new Set<string>();

  for (const roster of rosters) {
    for (const player of roster.players ?? []) {
      if (player.playerId) {
        playerIds.add(player.playerId);
      }
    }
  }

  for (const matchup of matchups) {
    for (const team of matchup.teams ?? []) {
      for (const playerId of [
        ...(team.players ?? []),
        ...(team.starters ?? []),
      ]) {
        if (playerId) {
          playerIds.add(playerId);
        }
      }
    }
  }

  return playerIds;
}

function isDevelopment() {
  return process.env.NODE_ENV !== "production";
}

function getSafeErrorDetails(error: unknown) {
  if (!(error instanceof Error)) {
    return {
      name: "UnknownError",
      message: String(error),
    };
  }

  const maybePrismaError = error as Error & {
    code?: string;
    clientVersion?: string;
    meta?: unknown;
  };

  return {
    name: error.name,
    message: redactSensitiveText(error.message),
    code: maybePrismaError.code,
    clientVersion: maybePrismaError.clientVersion,
    meta: sanitizeMeta(maybePrismaError.meta),
  };
}

function sanitizeMeta(meta: unknown) {
  if (!meta || typeof meta !== "object") return meta;

  return JSON.parse(JSON.stringify(meta), (_key, value) =>
    typeof value === "string" ? redactSensitiveText(value) : value,
  );
}

function redactSensitiveText(value: string) {
  return value
    .replace(/postgres(?:ql)?:\/\/[^\s"'<>]+/gi, "[REDACTED_DATABASE_URL]")
    .replace(/password=[^\s"'&]+/gi, "password=[REDACTED]");
}
