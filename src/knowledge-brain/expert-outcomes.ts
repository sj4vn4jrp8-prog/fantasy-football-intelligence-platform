import { generateIntelligenceSnapshotsForPlayers } from "@/knowledge-brain/intelligence-snapshots";
import { normalizeTargetSeason } from "@/knowledge-brain/freshness";
import { db } from "@/lib/db";
import type { OutcomeGrade, OutcomeType, Prisma } from "@/generated/prisma/client";

export type ExpertOutcomeFilters = {
  targetSeason?: number | string | null;
  includeHistorical?: boolean;
};

export type SaveExpertTakeOutcomeInput = {
  expertTakeId: string;
  outcomeType: string;
  outcomeValue?: string | null;
  outcomeDate?: string | Date | null;
  grade: string;
  confidence?: number | string | null;
  notes?: string | null;
};

const OUTCOME_TYPES = [
  "PLAYER_FINISH",
  "START_SIT_RESULT",
  "WAIVER_VALUE",
  "DRAFT_VALUE",
  "TRADE_VALUE",
  "INJURY_RESULT",
  "BREAKOUT_RESULT",
  "FADE_RESULT",
  "MANUAL",
] as const satisfies readonly OutcomeType[];

const OUTCOME_GRADES = [
  "CORRECT",
  "PARTIALLY_CORRECT",
  "INCORRECT",
  "PUSH",
  "NEEDS_REVIEW",
] as const satisfies readonly OutcomeGrade[];

const EXPERT_TAKE_OUTCOME_INCLUDE = {
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
  sourceVideo: {
    select: {
      title: true,
      url: true,
      publishedAt: true,
    },
  },
  transcript: {
    select: {
      freshnessLabel: true,
      publishDate: true,
    },
  },
} satisfies Prisma.ExpertTakeInclude;

type ExpertTakeForGrading = Prisma.ExpertTakeGetPayload<{
  include: typeof EXPERT_TAKE_OUTCOME_INCLUDE;
}>;

export async function getOutcomeGradingDashboard(
  filters: ExpertOutcomeFilters = {},
) {
  const normalizedFilters = normalizeOutcomeFilters(filters);
  const transcriptWhere = buildTranscriptWhere(normalizedFilters);
  const [takesAwaitingGrading, recentlyGradedTakes, expertsWithGradedAccuracy] =
    await Promise.all([
      db.expertTake.findMany({
        where: {
          reviewStatus: "APPROVED",
          transcript: {
            is: transcriptWhere,
          },
          OR: [
            { outcome: null },
            {
              outcome: {
                is: {
                  grade: "NEEDS_REVIEW",
                },
              },
            },
          ],
        },
        include: EXPERT_TAKE_OUTCOME_INCLUDE,
        orderBy: { createdAt: "desc" },
        take: 50,
      }),
      getRecentlyGradedTakes(8),
      getExpertsWithGradedAccuracy(8),
    ]);

  return {
    filters: normalizedFilters,
    outcomeTypeOptions: OUTCOME_TYPES,
    gradeOptions: OUTCOME_GRADES,
    takesAwaitingGrading: takesAwaitingGrading.map(formatTakeForGrading),
    recentlyGradedTakes,
    expertsWithGradedAccuracy,
  };
}

export async function saveExpertTakeOutcome(input: SaveExpertTakeOutcomeInput) {
  const normalizedInput = normalizeOutcomeInput(input);
  const expertTake = await db.expertTake.findUnique({
    where: { id: normalizedInput.expertTakeId },
    include: {
      expert: {
        select: {
          id: true,
          name: true,
        },
      },
      transcript: {
        select: {
          contentSeason: true,
        },
      },
      player: {
        select: {
          id: true,
        },
      },
    },
  });

  if (!expertTake) {
    throw new Error("Expert take was not found.");
  }

  if (expertTake.reviewStatus !== "APPROVED") {
    throw new Error("Approve this expert take before grading its outcome.");
  }

  const outcome = await db.expertTakeOutcome.upsert({
    where: {
      expertTakeId: normalizedInput.expertTakeId,
    },
    create: normalizedInput,
    update: {
      outcomeType: normalizedInput.outcomeType,
      outcomeValue: normalizedInput.outcomeValue,
      outcomeDate: normalizedInput.outcomeDate,
      grade: normalizedInput.grade,
      confidence: normalizedInput.confidence,
      notes: normalizedInput.notes,
    },
  });
  const season =
    expertTake.transcript?.contentSeason ??
    normalizedInput.outcomeDate?.getFullYear() ??
    normalizeTargetSeason();
  const snapshots = await calculateExpertAccuracySnapshots({
    expertId: expertTake.expertId,
    season,
  });

  if (expertTake.player?.id) {
    await generateIntelligenceSnapshotsForPlayers({
      playerIds: [expertTake.player.id],
      expertIds: [expertTake.expertId],
      contentSeason: season,
      generationType: "MANUAL_REVIEW",
      reason: "Manual expert take outcome grading changed accuracy inputs.",
    });
  }

  return {
    outcome,
    expertName: expertTake.expert.name,
    snapshotsUpdated: snapshots.length,
  };
}

export async function calculateExpertAccuracySnapshots({
  expertId,
  season,
}: {
  expertId: string;
  season: number;
}) {
  const outcomes = await db.expertTakeOutcome.findMany({
    where: {
      grade: {
        not: "NEEDS_REVIEW",
      },
      expertTake: {
        expertId,
        reviewStatus: "APPROVED",
        transcript: {
          is: {
            contentSeason: season,
          },
        },
      },
    },
    include: {
      expertTake: {
        include: {
          player: {
            select: {
              position: true,
            },
          },
        },
      },
    },
  });
  const snapshotInputs = buildSnapshotInputs({
    expertId,
    season,
    outcomes,
  });
  const snapshots = [];

  for (const snapshotInput of snapshotInputs) {
    snapshots.push(
      await db.expertAccuracySnapshot.upsert({
        where: {
          expertId_season_position_takeType: {
            expertId,
            season,
            position: snapshotInput.position,
            takeType: snapshotInput.takeType,
          },
        },
        create: snapshotInput,
        update: {
          totalGraded: snapshotInput.totalGraded,
          correctCount: snapshotInput.correctCount,
          partialCount: snapshotInput.partialCount,
          incorrectCount: snapshotInput.incorrectCount,
          pushCount: snapshotInput.pushCount,
          accuracyRate: snapshotInput.accuracyRate,
          lastCalculatedAt: snapshotInput.lastCalculatedAt,
        },
      }),
    );
  }

  return snapshots;
}

export async function getExpertOutcomeSummary(expertId: string, season?: number) {
  const snapshot = await db.expertAccuracySnapshot.findFirst({
    where: {
      expertId,
      ...(season ? { season } : {}),
      position: "ALL",
      takeType: "ALL",
    },
    orderBy: { lastCalculatedAt: "desc" },
  });

  return snapshot
    ? {
        totalGraded: snapshot.totalGraded,
        correctCount: snapshot.correctCount,
        partialCount: snapshot.partialCount,
        incorrectCount: snapshot.incorrectCount,
        pushCount: snapshot.pushCount,
        accuracyRate: snapshot.accuracyRate,
        lastCalculatedAt: snapshot.lastCalculatedAt,
      }
    : {
        totalGraded: 0,
        correctCount: 0,
        partialCount: 0,
        incorrectCount: 0,
        pushCount: 0,
        accuracyRate: null,
        lastCalculatedAt: null,
      };
}

export async function getRecentlyGradedTakes(limit = 6) {
  const outcomes = await db.expertTakeOutcome.findMany({
    where: {
      grade: {
        not: "NEEDS_REVIEW",
      },
      expertTake: {
        reviewStatus: "APPROVED",
      },
    },
    include: {
      expertTake: {
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
          sourceVideo: {
            select: {
              title: true,
              url: true,
              publishedAt: true,
            },
          },
        },
      },
    },
    orderBy: { updatedAt: "desc" },
    take: limit,
  });

  return outcomes.map((outcome) => ({
    id: outcome.id,
    expertTakeId: outcome.expertTakeId,
    expertId: outcome.expertTake.expert.id,
    expertName: outcome.expertTake.expert.name,
    playerId: outcome.expertTake.player?.id ?? null,
    playerName: outcome.expertTake.player?.fullName ?? "Unknown player",
    position: outcome.expertTake.player?.position ?? "--",
    team: outcome.expertTake.player?.team ?? null,
    summary: outcome.expertTake.summary,
    sentiment: outcome.expertTake.sentiment,
    takeType: outcome.expertTake.takeType,
    sourceTitle: outcome.expertTake.sourceVideo.title,
    publishedAt: outcome.expertTake.sourceVideo.publishedAt,
    outcomeType: outcome.outcomeType,
    outcomeValue: outcome.outcomeValue,
    outcomeDate: outcome.outcomeDate,
    grade: outcome.grade,
    confidence: outcome.confidence,
    notes: outcome.notes,
    updatedAt: outcome.updatedAt,
  }));
}

export async function getExpertsWithGradedAccuracy(limit = 6) {
  const snapshots = await db.expertAccuracySnapshot.findMany({
    where: {
      position: "ALL",
      takeType: "ALL",
      totalGraded: {
        gt: 0,
      },
    },
    include: {
      expert: {
        select: {
          id: true,
          name: true,
        },
      },
    },
    orderBy: [{ accuracyRate: "desc" }, { totalGraded: "desc" }],
    take: limit,
  });

  return snapshots.map((snapshot) => ({
    expertId: snapshot.expert.id,
    expertName: snapshot.expert.name,
    season: snapshot.season,
    totalGraded: snapshot.totalGraded,
    correctCount: snapshot.correctCount,
    partialCount: snapshot.partialCount,
    incorrectCount: snapshot.incorrectCount,
    pushCount: snapshot.pushCount,
    accuracyRate: snapshot.accuracyRate,
    lastCalculatedAt: snapshot.lastCalculatedAt,
  }));
}

function buildSnapshotInputs({
  expertId,
  season,
  outcomes,
}: {
  expertId: string;
  season: number;
  outcomes: Array<{
    grade: OutcomeGrade;
    expertTake: {
      takeType: string;
      player: {
        position: string;
      } | null;
    };
  }>;
}) {
  const groupedOutcomes = new Map<string, typeof outcomes>();

  for (const outcome of outcomes) {
    const position = outcome.expertTake.player?.position ?? "UNKNOWN";
    const takeType = outcome.expertTake.takeType;
    const keys = [
      "ALL|ALL",
      `${position}|ALL`,
      `ALL|${takeType}`,
      `${position}|${takeType}`,
    ];

    for (const key of keys) {
      groupedOutcomes.set(key, [...(groupedOutcomes.get(key) ?? []), outcome]);
    }
  }

  if (!groupedOutcomes.has("ALL|ALL")) {
    groupedOutcomes.set("ALL|ALL", []);
  }

  return Array.from(groupedOutcomes.entries()).map(([key, group]) => {
    const [position, takeType] = key.split("|");
    const counts = countGrades(group);

    return {
      expertId,
      season,
      position,
      takeType,
      totalGraded: group.length,
      correctCount: counts.correct,
      partialCount: counts.partial,
      incorrectCount: counts.incorrect,
      pushCount: counts.push,
      accuracyRate: calculateAccuracyRate(counts),
      lastCalculatedAt: new Date(),
    };
  });
}

function countGrades(outcomes: Array<{ grade: OutcomeGrade }>) {
  return {
    correct: outcomes.filter((outcome) => outcome.grade === "CORRECT").length,
    partial: outcomes.filter((outcome) => outcome.grade === "PARTIALLY_CORRECT")
      .length,
    incorrect: outcomes.filter((outcome) => outcome.grade === "INCORRECT")
      .length,
    push: outcomes.filter((outcome) => outcome.grade === "PUSH").length,
  };
}

function calculateAccuracyRate(counts: ReturnType<typeof countGrades>) {
  const denominator = counts.correct + counts.partial + counts.incorrect;

  if (denominator === 0) return 0;

  return Math.round(((counts.correct + counts.partial * 0.5) / denominator) * 100);
}

function normalizeOutcomeInput(input: SaveExpertTakeOutcomeInput) {
  const expertTakeId = input.expertTakeId.trim();

  if (!expertTakeId) {
    throw new Error("Expert take ID is required.");
  }

  return {
    expertTakeId,
    outcomeType: normalizeOutcomeType(input.outcomeType),
    outcomeValue: normalizeOptionalString(input.outcomeValue),
    outcomeDate: parseOptionalDate(input.outcomeDate),
    grade: normalizeOutcomeGrade(input.grade),
    confidence: normalizeConfidence(input.confidence),
    notes: normalizeOptionalString(input.notes),
  };
}

function normalizeOutcomeType(value: string): OutcomeType {
  const normalizedValue = value.trim().toUpperCase();
  const matchedType = OUTCOME_TYPES.find((type) => type === normalizedValue);

  if (!matchedType) {
    throw new Error("Select a valid outcome type.");
  }

  return matchedType;
}

function normalizeOutcomeGrade(value: string): OutcomeGrade {
  const normalizedValue = value.trim().toUpperCase();
  const matchedGrade = OUTCOME_GRADES.find((grade) => grade === normalizedValue);

  if (!matchedGrade) {
    throw new Error("Select a valid outcome grade.");
  }

  return matchedGrade;
}

function normalizeConfidence(value: number | string | null | undefined) {
  const parsedValue = Number(value ?? 0.5);

  if (!Number.isFinite(parsedValue)) return 0.5;

  return Math.min(1, Math.max(0, parsedValue));
}

function normalizeOptionalString(value: string | null | undefined) {
  const trimmed = value?.trim();

  return trimmed ? trimmed : null;
}

function parseOptionalDate(value: string | Date | null | undefined) {
  if (!value) return null;

  const parsedDate = value instanceof Date ? value : new Date(value);

  return Number.isNaN(parsedDate.getTime()) ? null : parsedDate;
}

function formatTakeForGrading(take: ExpertTakeForGrading) {
  return {
    id: take.id,
    expertId: take.expert.id,
    expertName: take.expert.name,
    playerId: take.player?.id ?? null,
    playerName: take.player?.fullName ?? "Unknown player",
    position: take.player?.position ?? "--",
    team: take.player?.team ?? null,
    takeType: take.takeType,
    sentiment: take.sentiment,
    summary: take.summary,
    excerpt: take.excerpt,
    confidence: take.confidence,
    sourceTitle: take.sourceVideo.title,
    sourceUrl: take.sourceVideo.url,
    publishedAt: take.sourceVideo.publishedAt,
    freshnessLabel: take.transcript?.freshnessLabel ?? "STALE",
    publishDate: take.transcript?.publishDate ?? take.sourceVideo.publishedAt,
  };
}

function buildTranscriptWhere({
  targetSeason,
  includeHistorical,
}: ReturnType<typeof normalizeOutcomeFilters>): Prisma.TranscriptWhereInput {
  if (includeHistorical) return {};

  return {
    includeInCurrentAnalysis: true,
    contentSeason: targetSeason,
  };
}

function normalizeOutcomeFilters(filters: ExpertOutcomeFilters) {
  return {
    targetSeason: normalizeTargetSeason(filters.targetSeason),
    includeHistorical: Boolean(filters.includeHistorical),
  };
}
