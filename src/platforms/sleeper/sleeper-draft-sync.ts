import type {
  DraftRoomState,
  DraftSyncStatus,
  LiveDraftPick,
  LiveDraftState,
} from "@/domain/fantasy";
import { db } from "@/lib/db";
import {
  SleeperApiError,
  SleeperClient,
  SleeperLeagueNotFoundError,
} from "./sleeper-client";

type SleeperDraft = {
  draft_id?: string;
  league_id?: string;
  season?: string;
  status?: string;
  type?: string;
  metadata?: {
    name?: string;
  };
  settings?: {
    rounds?: number;
    teams?: number;
  };
};

type SleeperDraftPick = {
  pick_no?: number;
  round?: number;
  draft_slot?: number;
  roster_id?: number;
  player_id?: string;
  picked_by?: string;
  picked_at?: number | string | null;
  metadata?: {
    first_name?: string;
    last_name?: string;
    player_id?: string;
    position?: string;
    team?: string;
  };
};

type SyncSleeperDraftInput = {
  draftId?: string | null;
  internalLeagueId?: string | null;
  myTeamId?: string | null;
  sleeperLeagueId?: string | null;
  targetSeason?: number | string | null;
};

type LeagueForDraftSync = Awaited<
  ReturnType<typeof findInternalSleeperLeague>
>;

type PlayerLookup = Awaited<ReturnType<typeof buildPlayerLookup>>;

const nowIso = () => new Date().toISOString();

export async function syncSleeperDraft(
  input: SyncSleeperDraftInput,
  client = new SleeperClient(),
): Promise<LiveDraftState> {
  const targetSeason = normalizeNullableNumber(input.targetSeason);
  const league = await findInternalSleeperLeague(input);
  const sleeperLeagueId =
    input.sleeperLeagueId?.trim() || getSleeperLeagueId(league);

  if (!sleeperLeagueId) {
    return createEmptyDraftState({
      errors: [
        {
          code: "INVALID_LEAGUE",
          message:
            "Select an imported Sleeper league or enter a Sleeper league ID before syncing.",
          provider: "SLEEPER",
        },
      ],
      status: "INVALID_LEAGUE",
    });
  }

  try {
    const drafts = normalizeArray<SleeperDraft>(
      await client.getLeagueDrafts(sleeperLeagueId),
    );
    const selectedDraft = selectSleeperDraft({
      draftId: input.draftId,
      drafts,
      targetSeason,
    });

    if (!selectedDraft?.draft_id) {
      return createEmptyDraftState({
        errors: [
          {
            code: "NO_DRAFTS_FOUND",
            message:
              "No Sleeper drafts were found for this league and season.",
            provider: "SLEEPER",
          },
        ],
        status: "NO_DRAFTS_FOUND",
      });
    }

    const [draftMetadata, rawPicks, playerLookup] = await Promise.all([
      client.getDraft(selectedDraft.draft_id),
      client.getDraftPicks(selectedDraft.draft_id),
      buildPlayerLookup(),
    ]);
    const draft = isRecord(draftMetadata)
      ? ({ ...selectedDraft, ...draftMetadata } as SleeperDraft)
      : selectedDraft;
    const picks = normalizeArray<SleeperDraftPick>(rawPicks)
      .filter((pick) => pick.player_id || pick.metadata?.player_id)
      .sort((pickA, pickB) => (pickA.pick_no ?? 0) - (pickB.pick_no ?? 0));
    const teamLookup = buildTeamLookup(league);
    const warnings: string[] = [];

    if (!input.myTeamId && picks.length > 0) {
      warnings.push(
        "No user roster was selected, so synced picks are treated as other-team picks for availability.",
      );
    }

    const normalizedPicks: LiveDraftPick[] = [];

    for (const pick of picks) {
      normalizedPicks.push(
        await mapSleeperPick({
          draft,
          league,
          myTeamId: input.myTeamId,
          pick,
          playerLookup,
          teamLookup,
        }),
      );
    }

    const unmatchedPicks = normalizedPicks.filter((pick) => !pick.matched);
    if (unmatchedPicks.length > 0) {
      warnings.push(
        `${unmatchedPicks.length} Sleeper draft pick${
          unmatchedPicks.length === 1 ? "" : "s"
        } could not be matched to an internal player.`,
      );
    }

    const draftRoom = buildDraftRoomState({
      draft,
      internalLeagueId: league?.id ?? null,
      picksMade: normalizedPicks.length,
      sleeperLeagueId,
    });

    return {
      draftRoom,
      errors: [],
      matchedPicks: normalizedPicks.filter((pick) => pick.matched),
      picks: normalizedPicks,
      provider: "SLEEPER",
      source: "SLEEPER",
      status: getSyncStatus({
        draft,
        picks: normalizedPicks,
        warnings,
      }),
      syncedAt: nowIso(),
      unmatchedPicks,
      warnings,
    };
  } catch (error) {
    return createEmptyDraftState({
      errors: [mapSleeperSyncError(error)],
      status: getErrorStatus(error),
    });
  }
}

async function findInternalSleeperLeague(input: SyncSleeperDraftInput) {
  const orClauses = [];

  if (input.internalLeagueId?.trim()) {
    orClauses.push({ id: input.internalLeagueId.trim() });
    orClauses.push({
      externalIdentities: {
        some: {
          externalId: input.internalLeagueId.trim(),
          provider: "SLEEPER" as const,
        },
      },
    });
  }

  if (input.sleeperLeagueId?.trim()) {
    orClauses.push({
      externalIdentities: {
        some: {
          externalId: input.sleeperLeagueId.trim(),
          provider: "SLEEPER" as const,
        },
      },
    });
  }

  if (orClauses.length === 0) return null;

  return db.league.findFirst({
    include: {
      externalIdentities: true,
      teams: {
        include: {
          externalIdentities: true,
        },
      },
    },
    where: {
      OR: orClauses,
    },
  });
}

function getSleeperLeagueId(league: LeagueForDraftSync) {
  return league?.externalIdentities.find(
    (identity) => identity.provider === "SLEEPER",
  )?.externalId;
}

async function buildPlayerLookup() {
  const players = await db.player.findMany({
    include: {
      externalIdentities: {
        where: { provider: "SLEEPER" },
      },
    },
  });
  const bySleeperId = new Map<string, (typeof players)[number]>();
  const byNameTeamPosition = new Map<string, Array<(typeof players)[number]>>();

  for (const player of players) {
    for (const identity of player.externalIdentities) {
      bySleeperId.set(identity.externalId, player);
    }

    const key = getPlayerMatchKey({
      fullName: player.fullName,
      position: player.position,
      team: player.team,
    });
    byNameTeamPosition.set(key, [
      ...(byNameTeamPosition.get(key) ?? []),
      player,
    ]);
  }

  return {
    byNameTeamPosition,
    bySleeperId,
  };
}

function buildTeamLookup(league: LeagueForDraftSync) {
  const bySleeperRosterId = new Map<
    string,
    { id: string; name: string; sleeperRosterId: string }
  >();

  for (const team of league?.teams ?? []) {
    const sleeperIdentity = team.externalIdentities.find(
      (identity) => identity.provider === "SLEEPER",
    );
    if (!sleeperIdentity) continue;

    bySleeperRosterId.set(sleeperIdentity.externalId, {
      id: team.id,
      name: team.name,
      sleeperRosterId: sleeperIdentity.externalId,
    });
  }

  return bySleeperRosterId;
}

async function mapSleeperPick({
  draft,
  league,
  myTeamId,
  pick,
  playerLookup,
  teamLookup,
}: {
  draft: SleeperDraft;
  league: LeagueForDraftSync;
  myTeamId?: string | null;
  pick: SleeperDraftPick;
  playerLookup: PlayerLookup;
  teamLookup: ReturnType<typeof buildTeamLookup>;
}): Promise<LiveDraftPick> {
  const externalPlayerId =
    sanitizeString(pick.player_id) ?? sanitizeString(pick.metadata?.player_id);
  const sleeperRosterId =
    typeof pick.roster_id === "number" ? String(pick.roster_id) : null;
  const team = sleeperRosterId ? teamLookup.get(sleeperRosterId) : undefined;
  const playerMatch = await findInternalPlayerForPick({
    externalPlayerId,
    pick,
    playerLookup,
  });
  const teams = draft.settings?.teams ?? league?.teams.length ?? null;
  const overallPick = Math.max(1, Number(pick.pick_no) || 1);
  const round = Math.max(1, Number(pick.round) || 1);
  const pickInRound =
    teams && teams > 0
      ? ((overallPick - 1) % teams) + 1
      : Math.max(1, Number(pick.draft_slot) || overallPick);

  return {
    draftId: draft.draft_id ?? "",
    draftSlot: Number.isFinite(pick.draft_slot) ? Number(pick.draft_slot) : null,
    externalPickId: `${draft.draft_id ?? "draft"}-${overallPick}`,
    externalPlayerId,
    externalRosterId: sleeperRosterId,
    id: `SLEEPER-${draft.draft_id ?? "draft"}-${overallPick}`,
    internalPlayerId: playerMatch.playerId,
    internalTeamId: team?.id ?? null,
    matched: Boolean(playerMatch.playerId),
    matchMethod: playerMatch.matchMethod,
    nflTeam: sanitizeString(pick.metadata?.team),
    overallPick,
    pickedAt: formatSleeperPickedAt(pick.picked_at),
    pickedByExternalUserId: sanitizeString(pick.picked_by),
    pickInRound,
    playerName: getPickPlayerName(pick, externalPlayerId),
    position: sanitizeString(pick.metadata?.position),
    provider: "SLEEPER",
    raw: pick,
    round,
    teamName: team?.name ?? null,
    teamRole: myTeamId
      ? team?.id === myTeamId
        ? "USER"
        : "OTHER"
      : "UNKNOWN",
  };
}

async function findInternalPlayerForPick({
  externalPlayerId,
  pick,
  playerLookup,
}: {
  externalPlayerId: string | null;
  pick: SleeperDraftPick;
  playerLookup: PlayerLookup;
}) {
  if (externalPlayerId) {
    const player = playerLookup.bySleeperId.get(externalPlayerId);
    if (player) {
      return {
        matchMethod: "EXTERNAL_ID" as const,
        playerId: player.id,
      };
    }
  }

  const key = getPlayerMatchKey({
    fullName: getPickPlayerName(pick, externalPlayerId),
    position: pick.metadata?.position,
    team: pick.metadata?.team,
  });
  const matches = playerLookup.byNameTeamPosition.get(key) ?? [];

  if (matches.length === 1 && externalPlayerId) {
    await db.playerExternalIdentity.upsert({
      create: {
        externalId: externalPlayerId,
        metadata: {
          matchedBy: "SLEEPER_DRAFT_SYNC_NAME_TEAM_POSITION",
        },
        playerId: matches[0].id,
        provider: "SLEEPER",
      },
      update: {
        metadata: {
          matchedBy: "SLEEPER_DRAFT_SYNC_NAME_TEAM_POSITION",
        },
      },
      where: {
        provider_externalId: {
          externalId: externalPlayerId,
          provider: "SLEEPER",
        },
      },
    });

    playerLookup.bySleeperId.set(externalPlayerId, matches[0]);

    return {
      matchMethod: "NAME_TEAM_POSITION" as const,
      playerId: matches[0].id,
    };
  }

  return {
    matchMethod: "UNMATCHED" as const,
    playerId: null,
  };
}

function selectSleeperDraft({
  draftId,
  drafts,
  targetSeason,
}: {
  draftId?: string | null;
  drafts: SleeperDraft[];
  targetSeason: number | null;
}) {
  if (draftId?.trim()) {
    return drafts.find((draft) => draft.draft_id === draftId.trim()) ?? null;
  }

  const seasonDrafts = targetSeason
    ? drafts.filter((draft) => Number(draft.season) === targetSeason)
    : drafts;

  return [...seasonDrafts].sort(sortSleeperDraftsByUsefulness)[0] ?? null;
}

function sortSleeperDraftsByUsefulness(
  draftA: SleeperDraft,
  draftB: SleeperDraft,
) {
  return getDraftStatusScore(draftB.status) - getDraftStatusScore(draftA.status);
}

function getDraftStatusScore(status?: string) {
  const normalizedStatus = String(status ?? "").toLowerCase();

  if (["drafting", "in_progress", "in draft"].includes(normalizedStatus)) {
    return 5;
  }
  if (["complete", "completed"].includes(normalizedStatus)) return 4;
  if (["paused"].includes(normalizedStatus)) return 3;
  if (["pre_draft", "not_started"].includes(normalizedStatus)) return 2;

  return 1;
}

function buildDraftRoomState({
  draft,
  internalLeagueId,
  picksMade,
  sleeperLeagueId,
}: {
  draft: SleeperDraft;
  internalLeagueId: string | null;
  picksMade: number;
  sleeperLeagueId: string;
}): DraftRoomState {
  const teamCount = draft.settings?.teams ?? null;
  const currentOverallPick = picksMade + 1;
  const currentRound =
    teamCount && teamCount > 0
      ? Math.floor((currentOverallPick - 1) / teamCount) + 1
      : Math.max(1, Number(draft.settings?.rounds) || 1);
  const currentPick =
    teamCount && teamCount > 0
      ? ((currentOverallPick - 1) % teamCount) + 1
      : currentOverallPick;

  return {
    currentOverallPick,
    currentPick,
    currentRound,
    draftId: draft.draft_id ?? null,
    internalLeagueId,
    leagueExternalId: sleeperLeagueId,
    name: draft.metadata?.name ?? null,
    picksMade,
    provider: "SLEEPER",
    rounds: draft.settings?.rounds ?? null,
    season: normalizeNullableNumber(draft.season),
    status: draft.status ?? "unknown",
    teams: teamCount,
    type: draft.type ?? null,
  };
}

function getSyncStatus({
  draft,
  picks,
  warnings,
}: {
  draft: SleeperDraft;
  picks: LiveDraftPick[];
  warnings: string[];
}): DraftSyncStatus {
  const status = String(draft.status ?? "").toLowerCase();

  if (picks.length === 0 && ["pre_draft", "not_started"].includes(status)) {
    return "DRAFT_NOT_STARTED";
  }
  if (picks.length === 0) return "NO_PICKS";
  if (warnings.length > 0) return "SYNCED_WITH_WARNINGS";

  return "SYNCED";
}

function createEmptyDraftState({
  errors,
  status,
}: {
  errors: LiveDraftState["errors"];
  status: DraftSyncStatus;
}): LiveDraftState {
  return {
    draftRoom: null,
    errors,
    matchedPicks: [],
    picks: [],
    provider: "SLEEPER",
    source: "SLEEPER",
    status,
    syncedAt: nowIso(),
    unmatchedPicks: [],
    warnings: [],
  };
}

function mapSleeperSyncError(error: unknown) {
  if (error instanceof SleeperLeagueNotFoundError) {
    return {
      code: "INVALID_LEAGUE",
      message:
        "Sleeper could not find that league or draft. Check the league ID or draft ID and try again.",
      provider: "SLEEPER" as const,
    };
  }
  if (error instanceof SleeperApiError) {
    return {
      code: "PROVIDER_UNAVAILABLE",
      message: error.message,
      provider: "SLEEPER" as const,
    };
  }
  if (error instanceof Error) {
    return {
      code: "ERROR",
      message: error.message,
      provider: "SLEEPER" as const,
    };
  }

  return {
    code: "ERROR",
    message: "Sleeper draft sync failed for an unknown reason.",
    provider: "SLEEPER" as const,
  };
}

function getErrorStatus(error: unknown): DraftSyncStatus {
  if (error instanceof SleeperLeagueNotFoundError) return "INVALID_LEAGUE";
  if (error instanceof SleeperApiError) return "PROVIDER_UNAVAILABLE";

  return "ERROR";
}

function getPickPlayerName(
  pick: SleeperDraftPick,
  fallbackId?: string | null,
) {
  const fullName = [
    sanitizeString(pick.metadata?.first_name),
    sanitizeString(pick.metadata?.last_name),
  ]
    .filter(Boolean)
    .join(" ")
    .trim();

  return fullName || fallbackId || "Unknown player";
}

function getPlayerMatchKey({
  fullName,
  position,
  team,
}: {
  fullName: string;
  position?: string | null;
  team?: string | null;
}) {
  return [
    normalizeText(fullName),
    normalizeText(team ?? ""),
    normalizeText(position ?? ""),
  ].join("|");
}

function formatSleeperPickedAt(value: SleeperDraftPick["picked_at"]) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return new Date(value).toISOString();
  }
  if (typeof value === "string" && value.trim()) {
    const numericValue = Number(value);
    if (Number.isFinite(numericValue)) {
      return new Date(numericValue).toISOString();
    }
  }

  return null;
}

function normalizeNullableNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}

function sanitizeString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null;
}

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}
