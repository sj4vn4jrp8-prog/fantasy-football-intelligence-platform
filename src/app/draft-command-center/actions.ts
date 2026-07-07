"use server";

import { redirect } from "next/navigation";
import type { LiveDraftPick } from "@/domain/fantasy";
import { syncSleeperDraft } from "@/platforms/sleeper";

export async function syncSleeperDraftForCommandCenter(formData: FormData) {
  const params = new URLSearchParams(getFormString(formData, "currentQuery"));
  const leagueId = getFormString(formData, "leagueId") || params.get("leagueId");
  const sleeperLeagueId = getFormString(formData, "sleeperLeagueId");
  const draftId = getFormString(formData, "sleeperDraftId");
  const myTeamId = getFormString(formData, "myTeamId");
  const targetSeason =
    getFormString(formData, "targetSeason") || params.get("targetSeason");
  const result = await syncSleeperDraft({
    draftId,
    internalLeagueId: leagueId,
    myTeamId,
    sleeperLeagueId,
    targetSeason,
  });
  const draftedByMe = new Set(parsePlayerIdList(params.get("draftedByMe")));
  const draftedByOthers = new Set(
    parsePlayerIdList(params.get("draftedByOthers")),
  );

  for (const pick of result.matchedPicks) {
    if (!pick.internalPlayerId) continue;

    draftedByMe.delete(pick.internalPlayerId);
    draftedByOthers.delete(pick.internalPlayerId);

    if (pick.teamRole === "USER") {
      draftedByMe.add(pick.internalPlayerId);
    } else {
      draftedByOthers.add(pick.internalPlayerId);
    }
  }

  setListParam(params, "draftedByMe", Array.from(draftedByMe));
  setListParam(params, "draftedByOthers", Array.from(draftedByOthers));
  params.set("draftSyncMode", "SLEEPER");
  params.set("draftSyncProvider", "SLEEPER");
  params.set("draftSyncStatus", result.status);
  params.set("draftSyncAt", result.syncedAt);
  params.set("draftSyncImported", String(result.picks.length));
  params.set("draftSyncMatched", String(result.matchedPicks.length));
  params.set("draftSyncUnmatched", String(result.unmatchedPicks.length));

  if (draftId || result.draftRoom?.draftId) {
    params.set("sleeperDraftId", draftId || result.draftRoom?.draftId || "");
  }
  if (myTeamId) params.set("syncMyTeamId", myTeamId);
  if (leagueId) params.set("leagueId", leagueId);
  if (targetSeason) params.set("targetSeason", targetSeason);
  if (result.draftRoom) {
    params.set("draftRound", String(result.draftRoom.currentRound));
    params.set("draftPick", String(result.draftRoom.currentPick));
  }

  params.delete("lastAction");
  params.set(
    "draftSyncWarnings",
    JSON.stringify([
      ...result.warnings,
      ...result.errors.map((error) => error.message),
    ].slice(0, 6)),
  );
  params.set(
    "draftSyncUnmatchedPicks",
    JSON.stringify(
      result.unmatchedPicks.slice(0, 8).map(formatUnmatchedPickSummary),
    ),
  );

  const query = params.toString();
  redirect(query ? `/draft-command-center?${query}` : "/draft-command-center");
}

function formatUnmatchedPickSummary(pick: LiveDraftPick) {
  return {
    player: pick.playerName,
    position: pick.position,
    pick: pick.overallPick,
    sleeperPlayerId: pick.externalPlayerId,
    team: pick.nflTeam,
  };
}

function getFormString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : "";
}

function parsePlayerIdList(value: string | null) {
  return String(value ?? "")
    .split(",")
    .map((playerId) => playerId.trim())
    .filter(Boolean);
}

function setListParam(
  params: URLSearchParams,
  key: string,
  values: string[],
) {
  if (values.length > 0) {
    params.set(key, values.join(","));
  } else {
    params.delete(key);
  }
}
