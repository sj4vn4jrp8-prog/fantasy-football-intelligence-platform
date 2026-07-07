import type { FantasyPlatform, ProviderName } from "./models";

export type DraftSyncProvider = Extract<
  FantasyPlatform,
  "SLEEPER" | "YAHOO" | "ESPN"
>;

export type DraftSyncSource = "MANUAL" | DraftSyncProvider;

export type DraftSyncStatus =
  | "IDLE"
  | "SYNCED"
  | "SYNCED_WITH_WARNINGS"
  | "NO_DRAFTS_FOUND"
  | "DRAFT_NOT_STARTED"
  | "NO_PICKS"
  | "INVALID_LEAGUE"
  | "PROVIDER_UNAVAILABLE"
  | "ERROR";

export type DraftPickTeamRole = "USER" | "OTHER" | "UNKNOWN";

export type DraftSyncError = {
  code: DraftSyncStatus | string;
  message: string;
  provider?: ProviderName;
};

export type LiveDraftPick = {
  id: string;
  provider: DraftSyncProvider;
  draftId: string;
  externalPickId: string;
  overallPick: number;
  round: number;
  pickInRound: number;
  draftSlot: number | null;
  externalPlayerId: string | null;
  internalPlayerId: string | null;
  playerName: string;
  position: string | null;
  nflTeam: string | null;
  externalRosterId: string | null;
  internalTeamId: string | null;
  teamName: string | null;
  pickedByExternalUserId: string | null;
  pickedAt: string | null;
  teamRole: DraftPickTeamRole;
  matched: boolean;
  matchMethod: "EXTERNAL_ID" | "NAME_TEAM_POSITION" | "UNMATCHED";
  raw?: unknown;
};

export type DraftRoomState = {
  provider: DraftSyncProvider;
  draftId: string | null;
  name: string | null;
  leagueExternalId: string | null;
  internalLeagueId: string | null;
  season: number | null;
  status: string;
  type: string | null;
  rounds: number | null;
  teams: number | null;
  picksMade: number;
  currentOverallPick: number;
  currentRound: number;
  currentPick: number;
};

export type LiveDraftState = {
  source: DraftSyncSource;
  provider: DraftSyncProvider;
  status: DraftSyncStatus;
  syncedAt: string;
  draftRoom: DraftRoomState | null;
  picks: LiveDraftPick[];
  matchedPicks: LiveDraftPick[];
  unmatchedPicks: LiveDraftPick[];
  warnings: string[];
  errors: DraftSyncError[];
};
