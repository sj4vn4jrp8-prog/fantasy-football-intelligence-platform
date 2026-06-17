import { NextRequest, NextResponse } from "next/server";
import {
  importMockProjectionsForLeague,
  ProjectionImportLeagueNotFoundError,
} from "@/lib/projection-import";

type MockProjectionRouteContext = {
  params: Promise<{
    leagueId: string;
  }>;
};

export async function POST(
  request: NextRequest,
  { params }: MockProjectionRouteContext,
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
    const summary = await importMockProjectionsForLeague(leagueId, week);

    return NextResponse.json({ summary });
  } catch (error) {
    if (error instanceof ProjectionImportLeagueNotFoundError) {
      return NextResponse.json(
        { error: "That league was not found." },
        { status: 404 },
      );
    }

    console.error(
      "Mock projection import failed",
      JSON.stringify({
        leagueId,
        week,
        error: getSafeErrorDetails(error),
      }),
    );

    return NextResponse.json(
      { error: "Mock projections could not be saved. Check the server logs." },
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
    .replace(/api_key=[^\s"'&]+/gi, "api_key=[REDACTED]");
}
