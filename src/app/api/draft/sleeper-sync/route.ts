import { NextResponse } from "next/server";
import { syncSleeperDraft } from "@/platforms/sleeper";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);

  return runSleeperSync({
    draftId: url.searchParams.get("draftId"),
    internalLeagueId: url.searchParams.get("leagueId"),
    myTeamId: url.searchParams.get("myTeamId"),
    sleeperLeagueId: url.searchParams.get("sleeperLeagueId"),
    targetSeason: url.searchParams.get("targetSeason"),
  });
}

export async function POST(request: Request) {
  let body: Record<string, unknown>;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      {
        errors: [
          {
            code: "INVALID_REQUEST",
            message: "Send JSON with leagueId or sleeperLeagueId to sync.",
          },
        ],
        status: "ERROR",
      },
      { status: 400 },
    );
  }

  return runSleeperSync({
    draftId: getString(body.draftId),
    internalLeagueId: getString(body.leagueId ?? body.internalLeagueId),
    myTeamId: getString(body.myTeamId),
    sleeperLeagueId: getString(body.sleeperLeagueId),
    targetSeason: getString(body.targetSeason),
  });
}

async function runSleeperSync(input: {
  draftId?: string | null;
  internalLeagueId?: string | null;
  myTeamId?: string | null;
  sleeperLeagueId?: string | null;
  targetSeason?: string | null;
}) {
  const result = await syncSleeperDraft(input);
  const statusCode =
    result.status === "INVALID_LEAGUE"
      ? 400
      : result.status === "PROVIDER_UNAVAILABLE"
        ? 503
        : 200;

  return NextResponse.json(result, { status: statusCode });
}

function getString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null;
}
