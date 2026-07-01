import { getExpertPlayerMemories } from "@/knowledge-brain/expert-memory";
import { getDefaultTargetSeason, normalizeTargetSeason } from "@/knowledge-brain/freshness";
import { getPlayerIntelligenceProfile } from "@/knowledge-brain/player-intelligence";
import { getPlayerTrustProfiles } from "@/knowledge-brain/trust-engine";
import { db } from "@/lib/db";
import type {
  IntelligenceSnapshotGenerationType,
  Prisma,
} from "@/generated/prisma/client";

export type SnapshotGenerationInput = {
  playerIds: string[];
  expertIds?: string[];
  contentSeason?: number | string | null;
  generationType: IntelligenceSnapshotGenerationType;
  snapshotDate?: Date;
  reason?: string;
};

export type SnapshotMovement = {
  previousValue: number | string | null;
  currentValue: number | string | null;
  numericChange: number | null;
  direction: "UP" | "DOWN" | "UNCHANGED" | "CHANGED" | "NEW";
  label: string;
};

export type PlayerHistoryTimeline = Awaited<
  ReturnType<typeof getPlayerIntelligenceHistory>
>;

type PlayerTrustSnapshotForHistory = Prisma.PlayerTrustSnapshotGetPayload<{
  include: {
    player: {
      select: {
        id: true;
        fullName: true;
        position: true;
        team: true;
      };
    };
  };
}>;

type PlayerIntelligenceSnapshotForHistory =
  Prisma.PlayerIntelligenceSnapshotGetPayload<{
    include: {
      player: {
        select: {
          id: true;
          fullName: true;
          position: true;
          team: true;
        };
      };
    };
  }>;

type ExpertMemorySnapshotForHistory = Prisma.ExpertMemorySnapshotGetPayload<{
  include: {
    expert: {
      select: {
        id: true;
        name: true;
      };
    };
    player: {
      select: {
        id: true;
        fullName: true;
        position: true;
        team: true;
      };
    };
  };
}>;

export async function generateIntelligenceSnapshotsForPlayers(
  input: SnapshotGenerationInput,
) {
  const playerIds = Array.from(new Set(input.playerIds.filter(Boolean)));

  if (playerIds.length === 0) {
    return {
      expertMemorySnapshotsCreated: 0,
      playerTrustSnapshotsCreated: 0,
      playerIntelligenceSnapshotsCreated: 0,
    };
  }

  const contentSeason = normalizeTargetSeason(
    input.contentSeason ?? getDefaultTargetSeason(),
  );
  const snapshotDate = input.snapshotDate ?? new Date();
  const [expertMemoryCount, playerTrustCount, playerIntelligenceCount] =
    await Promise.all([
      snapshotExpertMemory({
        contentSeason,
        expertIds: input.expertIds,
        generationType: input.generationType,
        playerIds,
        reason: input.reason,
        snapshotDate,
      }),
      snapshotPlayerTrust({
        contentSeason,
        generationType: input.generationType,
        playerIds,
        reason: input.reason,
        snapshotDate,
      }),
      snapshotPlayerIntelligence({
        contentSeason,
        generationType: input.generationType,
        playerIds,
        reason: input.reason,
        snapshotDate,
      }),
    ]);

  return {
    expertMemorySnapshotsCreated: expertMemoryCount,
    playerTrustSnapshotsCreated: playerTrustCount,
    playerIntelligenceSnapshotsCreated: playerIntelligenceCount,
  };
}

export async function getPlayerIntelligenceHistory({
  playerId,
  targetSeason,
}: {
  playerId: string;
  targetSeason?: number | string | null;
}) {
  const contentSeason = normalizeTargetSeason(targetSeason);
  const [player, trustSnapshots, intelligenceSnapshots, expertMemorySnapshots] =
    await Promise.all([
      db.player.findUnique({
        where: { id: playerId },
        select: {
          id: true,
          fullName: true,
          position: true,
          team: true,
        },
      }),
      db.playerTrustSnapshot.findMany({
        where: {
          playerId,
          contentSeason,
        },
        include: {
          player: {
            select: {
              id: true,
              fullName: true,
              position: true,
              team: true,
            },
          },
        },
        orderBy: [{ version: "asc" }],
      }),
      db.playerIntelligenceSnapshot.findMany({
        where: {
          playerId,
          contentSeason,
        },
        include: {
          player: {
            select: {
              id: true,
              fullName: true,
              position: true,
              team: true,
            },
          },
        },
        orderBy: [{ version: "asc" }],
      }),
      db.expertMemorySnapshot.findMany({
        where: {
          playerId,
          contentSeason,
        },
        include: {
          expert: {
            select: {
              id: true,
              name: true,
            },
          },
          player: {
            select: {
              id: true,
              fullName: true,
              position: true,
              team: true,
            },
          },
        },
        orderBy: [{ snapshotDate: "asc" }, { version: "asc" }],
      }),
    ]);

  return {
    player,
    contentSeason,
    trustSnapshots,
    intelligenceSnapshots,
    expertMemorySnapshots,
    trustTimeline: buildTrustTimeline(trustSnapshots),
    intelligenceTimeline: buildIntelligenceTimeline(intelligenceSnapshots),
    expertMemoryTimeline: buildExpertMemoryTimeline(expertMemorySnapshots),
  };
}

export async function getPlayersWithSnapshotHistory(contentSeason?: number) {
  const normalizedSeason = normalizeTargetSeason(contentSeason);
  const players = await db.player.findMany({
    where: {
      OR: [
        {
          playerTrustSnapshots: {
            some: { contentSeason: normalizedSeason },
          },
        },
        {
          playerIntelligenceSnapshots: {
            some: { contentSeason: normalizedSeason },
          },
        },
        {
          expertMemorySnapshots: {
            some: { contentSeason: normalizedSeason },
          },
        },
      ],
    },
    orderBy: { fullName: "asc" },
    select: {
      id: true,
      fullName: true,
      position: true,
      team: true,
    },
  });

  return {
    contentSeason: normalizedSeason,
    players,
  };
}

export function calculateSnapshotMovement(
  previousValue: number | string | null | undefined,
  currentValue: number | string | null | undefined,
): SnapshotMovement {
  const previous = previousValue ?? null;
  const current = currentValue ?? null;

  if (previous === null && current !== null) {
    return {
      previousValue: null,
      currentValue: current,
      numericChange: null,
      direction: "NEW",
      label: "New signal",
    };
  }

  if (typeof previous === "number" && typeof current === "number") {
    const numericChange = current - previous;

    return {
      previousValue: previous,
      currentValue: current,
      numericChange,
      direction:
        numericChange > 0 ? "UP" : numericChange < 0 ? "DOWN" : "UNCHANGED",
      label:
        numericChange > 0
          ? `+${numericChange}`
          : numericChange < 0
            ? String(numericChange)
            : "No change",
    };
  }

  if (previous !== current) {
    return {
      previousValue: previous,
      currentValue: current,
      numericChange: null,
      direction: "CHANGED",
      label: `${previous ?? "None"} -> ${current ?? "None"}`,
    };
  }

  return {
    previousValue: previous,
    currentValue: current,
    numericChange: 0,
    direction: "UNCHANGED",
    label: "No change",
  };
}

async function snapshotExpertMemory({
  contentSeason,
  expertIds,
  generationType,
  playerIds,
  reason,
  snapshotDate,
}: {
  contentSeason: number;
  expertIds?: string[];
  generationType: IntelligenceSnapshotGenerationType;
  playerIds: string[];
  reason?: string;
  snapshotDate: Date;
}) {
  const memories = await getExpertPlayerMemories({
    targetSeason: contentSeason,
    includeHistorical: false,
  });
  const expertIdSet = expertIds?.length ? new Set(expertIds) : null;
  const playerIdSet = new Set(playerIds);
  let created = 0;

  for (const memory of memories) {
    if (!playerIdSet.has(memory.playerId)) continue;
    if (expertIdSet && !expertIdSet.has(memory.expertId)) continue;

    const version = await getNextExpertMemoryVersion({
      contentSeason,
      expertId: memory.expertId,
      playerId: memory.playerId,
    });
    const points = memory.timeline.points;
    const sourceSummaryIds = points
      .filter((point) => point.sourceType === "TRANSCRIPT_PLAYER_SUMMARY")
      .map((point) => point.id);
    const sourceTakeIds = points
      .filter((point) => point.sourceType === "EXPERT_TAKE_FALLBACK")
      .map((point) => point.id);

    await db.expertMemorySnapshot.create({
      data: {
        expertId: memory.expertId,
        playerId: memory.playerId,
        snapshotDate,
        contentSeason,
        stance: memory.memory.currentStance,
        trend: memory.memory.opinionTrend,
        convictionScore: memory.memory.convictionScore,
        convictionLabel: memory.memory.convictionLabel,
        confidence: roundToTwo(
          average(points.map((point) => point.confidence)) || 0.5,
        ),
        evidenceCount: points.reduce(
          (total, point) => total + Math.max(1, point.evidenceCount),
          0,
        ),
        explanationSummary: memory.memory.explanationBullets.join(" "),
        sourceSummaryIds,
        sourceTakeIds,
        metadata: {
          reason: reason ?? null,
          latestSourceTitle: memory.timeline.latestPoint?.sourceTitle ?? null,
          warnings: memory.memory.warnings,
          signals: memory.memory.signals,
        },
        generatedAt: snapshotDate,
        generationType,
        version,
      },
    });

    created += 1;
  }

  return created;
}

async function snapshotPlayerTrust({
  contentSeason,
  generationType,
  playerIds,
  reason,
  snapshotDate,
}: {
  contentSeason: number;
  generationType: IntelligenceSnapshotGenerationType;
  playerIds: string[];
  reason?: string;
  snapshotDate: Date;
}) {
  const playerIdSet = new Set(playerIds);
  const profiles = await getPlayerTrustProfiles({
    targetSeason: contentSeason,
    includeHistorical: false,
  });
  let created = 0;

  for (const profile of profiles) {
    if (!playerIdSet.has(profile.playerId)) continue;

    const version = await getNextPlayerTrustVersion({
      contentSeason,
      playerId: profile.playerId,
    });

    await db.playerTrustSnapshot.create({
      data: {
        playerId: profile.playerId,
        snapshotDate,
        contentSeason,
        trustScore: profile.playerTrustScore,
        stance: profile.stanceSummary,
        confidenceLabel: profile.confidenceLabel,
        sampleSizeLabel: profile.sampleSizeLabel,
        trend: profile.expertMemorySignal.label,
        evidenceCount: profile.evidenceCount,
        expertCount: profile.topSupportingExperts.length,
        explanationSummary:
          profile.breakdown.dimensions
            .slice(0, 3)
            .map(
              (dimension) =>
                `${dimension.label}: ${dimension.score}. ${dimension.explanation}`,
            )
            .join(" ") || "Trust profile generated from approved evidence.",
        warningCount:
          profile.disagreementWarnings.length + profile.lowSampleWarnings.length,
        metadata: {
          reason: reason ?? null,
          confidenceLabel: profile.confidenceLabel,
          topSupportingExperts: profile.topSupportingExperts,
          disagreementWarnings: profile.disagreementWarnings,
          lowSampleWarnings: profile.lowSampleWarnings,
          qualityReviewSignal: profile.qualityReviewSignal,
          expertMemorySignal: profile.expertMemorySignal,
        },
        generatedAt: snapshotDate,
        generationType,
        version,
      },
    });

    created += 1;
  }

  return created;
}

async function snapshotPlayerIntelligence({
  contentSeason,
  generationType,
  playerIds,
  reason,
  snapshotDate,
}: {
  contentSeason: number;
  generationType: IntelligenceSnapshotGenerationType;
  playerIds: string[];
  reason?: string;
  snapshotDate: Date;
}) {
  let created = 0;

  for (const playerId of playerIds) {
    const profile = await getPlayerIntelligenceProfile(playerId, {
      targetSeason: contentSeason,
      includeHistorical: false,
    });

    if (!profile) continue;

    const version = await getNextPlayerIntelligenceVersion({
      contentSeason,
      playerId,
    });
    const summary = profile.summary;

    await db.playerIntelligenceSnapshot.create({
      data: {
        playerId,
        snapshotDate,
        contentSeason,
        intelligenceScore: summary.intelligenceScore,
        intelligenceLabel: summary.intelligenceLabel,
        stance: summary.intelligenceLabel,
        trend: summary.trendDirection,
        confidence: calculateIntelligenceConfidence({
          expertCount: summary.expertCount,
          totalMentions: summary.totalMentions,
        }),
        evidenceCount: summary.totalMentions,
        mentionCount: summary.totalMentions,
        expertCount: summary.expertCount,
        bullishCount: summary.bullishCount,
        bearishCount: summary.bearishCount,
        neutralCount: summary.neutralCount,
        explanationSummary: `${summary.fullName} has a ${summary.intelligenceLabel.toLowerCase()} intelligence label with ${summary.totalMentions} mention${
          summary.totalMentions === 1 ? "" : "s"
        } from ${summary.expertCount} expert${summary.expertCount === 1 ? "" : "s"}.`,
        metadata: {
          reason: reason ?? null,
          latestMentionDate: summary.latestMentionDate?.toISOString() ?? null,
          intelligenceSource: summary.intelligenceSource,
          excludedHistoricalCount: summary.excludedHistoricalCount,
        },
        generatedAt: snapshotDate,
        generationType,
        version,
      },
    });

    created += 1;
  }

  return created;
}

function buildTrustTimeline(snapshots: PlayerTrustSnapshotForHistory[]) {
  return snapshots.map((snapshot, index) => {
    const previous = index > 0 ? snapshots[index - 1] : null;

    return {
      snapshot,
      movements: {
        trustScore: calculateSnapshotMovement(
          previous?.trustScore,
          snapshot.trustScore,
        ),
        confidence: calculateSnapshotMovement(
          previous?.confidenceLabel,
          snapshot.confidenceLabel,
        ),
        stance: calculateSnapshotMovement(previous?.stance, snapshot.stance),
        evidenceCount: calculateSnapshotMovement(
          previous?.evidenceCount,
          snapshot.evidenceCount,
        ),
      },
    };
  });
}

function buildIntelligenceTimeline(
  snapshots: PlayerIntelligenceSnapshotForHistory[],
) {
  return snapshots.map((snapshot, index) => {
    const previous = index > 0 ? snapshots[index - 1] : null;

    return {
      snapshot,
      movements: {
        intelligenceScore: calculateSnapshotMovement(
          previous?.intelligenceScore,
          snapshot.intelligenceScore,
        ),
        stance: calculateSnapshotMovement(previous?.stance, snapshot.stance),
        trend: calculateSnapshotMovement(previous?.trend, snapshot.trend),
        mentionCount: calculateSnapshotMovement(
          previous?.mentionCount,
          snapshot.mentionCount,
        ),
      },
    };
  });
}

function buildExpertMemoryTimeline(
  snapshots: ExpertMemorySnapshotForHistory[],
) {
  return snapshots.map((snapshot, index) => {
    const previous = findPreviousExpertMemorySnapshot(snapshots, snapshot, index);

    return {
      snapshot,
      movements: {
        convictionScore: calculateSnapshotMovement(
          previous?.convictionScore,
          snapshot.convictionScore,
        ),
        stance: calculateSnapshotMovement(previous?.stance, snapshot.stance),
        trend: calculateSnapshotMovement(previous?.trend, snapshot.trend),
        confidence: calculateSnapshotMovement(
          previous ? Math.round(previous.confidence * 100) : null,
          Math.round(snapshot.confidence * 100),
        ),
        evidenceCount: calculateSnapshotMovement(
          previous?.evidenceCount,
          snapshot.evidenceCount,
        ),
      },
    };
  });
}

function findPreviousExpertMemorySnapshot(
  snapshots: ExpertMemorySnapshotForHistory[],
  snapshot: ExpertMemorySnapshotForHistory,
  currentIndex: number,
) {
  for (let index = currentIndex - 1; index >= 0; index -= 1) {
    const candidate = snapshots[index];

    if (candidate.expertId === snapshot.expertId) return candidate;
  }

  return null;
}

async function getNextExpertMemoryVersion({
  contentSeason,
  expertId,
  playerId,
}: {
  contentSeason: number;
  expertId: string;
  playerId: string;
}) {
  const latest = await db.expertMemorySnapshot.findFirst({
    where: {
      contentSeason,
      expertId,
      playerId,
    },
    orderBy: { version: "desc" },
    select: { version: true },
  });

  return (latest?.version ?? 0) + 1;
}

async function getNextPlayerTrustVersion({
  contentSeason,
  playerId,
}: {
  contentSeason: number;
  playerId: string;
}) {
  const latest = await db.playerTrustSnapshot.findFirst({
    where: {
      contentSeason,
      playerId,
    },
    orderBy: { version: "desc" },
    select: { version: true },
  });

  return (latest?.version ?? 0) + 1;
}

async function getNextPlayerIntelligenceVersion({
  contentSeason,
  playerId,
}: {
  contentSeason: number;
  playerId: string;
}) {
  const latest = await db.playerIntelligenceSnapshot.findFirst({
    where: {
      contentSeason,
      playerId,
    },
    orderBy: { version: "desc" },
    select: { version: true },
  });

  return (latest?.version ?? 0) + 1;
}

function calculateIntelligenceConfidence({
  expertCount,
  totalMentions,
}: {
  expertCount: number;
  totalMentions: number;
}) {
  return roundToTwo(
    Math.min(0.95, 0.35 + Math.min(0.3, expertCount * 0.08) + Math.min(0.3, totalMentions * 0.025)),
  );
}

function average(values: number[]) {
  if (values.length === 0) return 0;

  return values.reduce((total, value) => total + value, 0) / values.length;
}

function roundToTwo(value: number) {
  return Math.round(value * 100) / 100;
}
