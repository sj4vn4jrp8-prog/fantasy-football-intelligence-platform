import { NextRequest, NextResponse } from "next/server";
import {
  FantasyProsApiUnavailableError,
  FantasyProsConfigurationError,
  FantasyProsNoProjectionsError,
  FantasyProsUnauthorizedError,
  importFantasyProsProjectionsForLeague,
  ProjectionImportLeagueNotFoundError,
  ProjectionImportNoMatchedPlayersError,
} from "@/lib/projection-import";

type FantasyProsProjectionRouteContext = {
  params: Promise<{
    leagueId: string;
  }>;
};

export async function POST(
  request: NextRequest,
  { params }: FantasyProsProjectionRouteContext,
) {
  const { leagueId } = await params;
  const body = await request.json().catch(() => null);
  const week = Number(body?.week ?? 1);

  if (!leagueId) {
    return NextResponse.json(
      { error: "leagueId is required" },
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
    const summary = await importFantasyProsProjectionsForLeague(leagueId, week);

    return NextResponse.json({ summary });
  } catch (error) {
    if (error instanceof ProjectionImportLeagueNotFoundError) {
      return NextResponse.json(
        { error: "That league was not found." },
        { status: 404 },
      );
    }

    if (error instanceof FantasyProsConfigurationError) {
      return NextResponse.json(
        {
          error:
            "FantasyPros is not configured. Add FANTASYPROS_API_KEY to your server environment.",
        },
        { status: 400 },
      );
    }

    if (error instanceof FantasyProsUnauthorizedError) {
      return NextResponse.json(
        {
          error:
            "FantasyPros rejected the configured API key. Check FANTASYPROS_API_KEY.",
        },
        { status: 401 },
      );
    }

    if (error instanceof FantasyProsNoProjectionsError) {
      return NextResponse.json(
        {
          error:
            "FantasyPros returned no projections for that season and week.",
        },
        { status: 404 },
      );
    }

    if (error instanceof ProjectionImportNoMatchedPlayersError) {
      return NextResponse.json(
        {
          error:
            "FantasyPros returned projections, but none matched rostered players in this league.",
        },
        { status: 422 },
      );
    }

    if (error instanceof FantasyProsApiUnavailableError) {
      return NextResponse.json(
        {
          error:
            "FantasyPros projections are unavailable right now. Try again later.",
        },
        { status: 502 },
      );
    }

    console.error(
      "FantasyPros projection import failed",
      JSON.stringify({
        leagueId,
        week,
        error: getSafeErrorDetails(error),
      }),
    );

    return NextResponse.json(
      {
        error:
          "FantasyPros projections could not be imported. Check the server logs.",
      },
      { status: 500 },
    );
  }
}

function getSafeErrorDetails(error: unknown) {
  if (!(error instanceof Error)) {
    return {
      name: "UnknownError",
      message: redactSensitiveText(String(error)),
    };
  }

  const maybeDatabaseError = error as Error & {
    code?: string;
    clientVersion?: string;
    meta?: unknown;
  };

  return {
    name: error.name,
    message: redactSensitiveText(error.message),
    code: maybeDatabaseError.code,
    clientVersion: maybeDatabaseError.clientVersion,
    meta: sanitizeMeta(maybeDatabaseError.meta),
    stack: error.stack ? redactSensitiveText(error.stack) : undefined,
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
    .replace(/password=[^\s"'&]+/gi, "password=[REDACTED]")
    .replace(/apikey=[^\s"'&]+/gi, "apikey=[REDACTED]")
    .replace(/api_key=[^\s"'&]+/gi, "api_key=[REDACTED]")
    .replace(/x-api-key[=:]\s*[^\s"',}]+/gi, "x-api-key=[REDACTED]");
}
