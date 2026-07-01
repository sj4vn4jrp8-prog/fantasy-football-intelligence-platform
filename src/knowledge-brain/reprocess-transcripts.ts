import { analyzeSavedTranscript, refreshTrendSignals } from "@/knowledge-brain/analyzeTranscript";
import { generateIntelligenceSnapshotsForPlayers } from "@/knowledge-brain/intelligence-snapshots";
import { db } from "@/lib/db";

type ReprocessScope = "transcript" | "sourceVideo";

type ReprocessKnowledgeBrainInput =
  | {
      scope: "transcript";
      transcriptId: string;
    }
  | {
      scope: "sourceVideo";
      sourceVideoId: string;
    };

const REPLACEABLE_REVIEW_STATUSES = [
  "PENDING",
  "NEEDS_EDIT",
  "DISMISSED",
] as const;

export async function reprocessKnowledgeBrainTranscriptSource(
  input: ReprocessKnowledgeBrainInput,
) {
  const scope = normalizeScope(input.scope);
  const transcripts =
    input.scope === "transcript"
      ? await findTranscriptScope(input.transcriptId)
      : await findSourceVideoScope(input.sourceVideoId);

  if (transcripts.length === 0) {
    throw new Error("No transcript was found for reprocessing.");
  }

  const primaryTranscript = transcripts[0];
  const run = await db.brainIngestionRun.create({
    data: {
      expertId: primaryTranscript.sourceVideo.expertId,
      source: primaryTranscript.sourceType,
      status: "RUNNING",
      itemsFound: transcripts.length,
      message: "Knowledge Brain transcript reprocessing started.",
      metadata: {
        operation: "REPROCESS_TRANSCRIPT_ANALYSIS",
        scope,
        transcriptIds: transcripts.map((transcript) => transcript.id),
        sourceVideoIds: Array.from(
          new Set(transcripts.map((transcript) => transcript.sourceVideoId)),
        ),
        approvedTakesPreserved: true,
        replaceableReviewStatuses: [...REPLACEABLE_REVIEW_STATUSES],
      },
    },
  });

  try {
    let oldUnapprovedTakeCount = 0;
    let oldOrphanMentionCount = 0;
    let newTakeCount = 0;
    let duplicatePendingTakeCount = 0;
    let playersMentioned = 0;
    let playerSummariesCreated = 0;
    let approvedPlayerSummariesPreserved = 0;
    let autoApprovedPlayerSummaries = 0;
    let playerSummariesNeedingHumanReview = 0;
    const affectedPlayerIds = new Set<string>();
    const affectedExpertIds = new Set<string>();

    for (const transcript of transcripts) {
      affectedExpertIds.add(transcript.sourceVideo.expertId);
      const cleanup = await removeUnapprovedAnalysisForTranscript(transcript.id);
      oldUnapprovedTakeCount += cleanup.oldUnapprovedTakeCount;
      oldOrphanMentionCount += cleanup.oldOrphanMentionCount;
      cleanup.affectedPlayerIds.forEach((playerId) =>
        affectedPlayerIds.add(playerId),
      );

      const analysis = await analyzeSavedTranscript({
        expertId: transcript.sourceVideo.expertId,
        sourceVideoId: transcript.sourceVideoId,
        transcriptId: transcript.id,
      });
      const duplicateCleanup = await removePendingDuplicatesOfApprovedTakes(
        transcript.id,
      );

      newTakeCount += Math.max(0, analysis.takesCreated - duplicateCleanup);
      duplicatePendingTakeCount += duplicateCleanup;
      playersMentioned += analysis.playersMentioned;
      playerSummariesCreated += analysis.playerSummariesCreated;
      approvedPlayerSummariesPreserved +=
        analysis.approvedPlayerSummariesPreserved;
      autoApprovedPlayerSummaries += analysis.autoApprovedPlayerSummaries;
      playerSummariesNeedingHumanReview +=
        analysis.playerSummariesNeedingHumanReview;

      const currentSummaries = await db.transcriptPlayerSummary.findMany({
        where: { transcriptId: transcript.id },
        select: {
          playerId: true,
        },
      });

      currentSummaries.forEach((summary) =>
        affectedPlayerIds.add(summary.playerId),
      );
    }

    if (affectedPlayerIds.size > 0) {
      await refreshTrendSignals(Array.from(affectedPlayerIds));
      await generateIntelligenceSnapshotsForPlayers({
        playerIds: Array.from(affectedPlayerIds),
        expertIds: Array.from(affectedExpertIds),
        contentSeason: primaryTranscript.contentSeason,
        generationType: "REPROCESSING",
        reason: "Transcript/source reprocessing completed.",
      });
    }

    await db.brainIngestionRun.update({
      where: { id: run.id },
      data: {
        status: "COMPLETED",
        completedAt: new Date(),
        transcriptsSaved: transcripts.length,
        takesCreated: newTakeCount,
        message: `Reprocessed ${transcripts.length} transcript${
          transcripts.length === 1 ? "" : "s"
        }. Preserved approved takes and replaced ${oldUnapprovedTakeCount} unapproved take${
          oldUnapprovedTakeCount === 1 ? "" : "s"
        }.`,
        metadata: {
          operation: "REPROCESS_TRANSCRIPT_ANALYSIS",
          scope,
          transcriptIds: transcripts.map((transcript) => transcript.id),
          sourceVideoIds: Array.from(
            new Set(transcripts.map((transcript) => transcript.sourceVideoId)),
          ),
          approvedTakesPreserved: true,
          oldUnapprovedTakeCount,
          oldOrphanMentionCount,
          newTakeCount,
          duplicatePendingTakeCount,
          playersMentioned,
          playerSummariesCreated,
          approvedPlayerSummariesPreserved,
          autoApprovedPlayerSummaries,
          playerSummariesNeedingHumanReview,
        },
      },
    });

    return {
      scope,
      transcriptCount: transcripts.length,
      oldUnapprovedTakeCount,
      oldOrphanMentionCount,
      newTakeCount,
      duplicatePendingTakeCount,
      playersMentioned,
      playerSummariesCreated,
      approvedPlayerSummariesPreserved,
      autoApprovedPlayerSummaries,
      playerSummariesNeedingHumanReview,
      approvedTakesPreserved: true,
      sourceTitle: primaryTranscript.sourceVideo.title,
    };
  } catch (error) {
    await db.brainIngestionRun.update({
      where: { id: run.id },
      data: {
        status: "FAILED",
        completedAt: new Date(),
        message:
          error instanceof Error ? error.message : "Reprocessing failed.",
      },
    });

    throw error;
  }
}

async function findTranscriptScope(transcriptId: string) {
  const normalizedTranscriptId = requireId(transcriptId, "Transcript ID is required.");
  const transcript = await db.transcript.findUnique({
    where: { id: normalizedTranscriptId },
    include: {
      sourceVideo: {
        select: {
          id: true,
          expertId: true,
          title: true,
        },
      },
    },
  });

  return transcript ? [transcript] : [];
}

async function findSourceVideoScope(sourceVideoId: string) {
  const normalizedSourceVideoId = requireId(
    sourceVideoId,
    "Source video ID is required.",
  );

  return db.transcript.findMany({
    where: { sourceVideoId: normalizedSourceVideoId },
    include: {
      sourceVideo: {
        select: {
          id: true,
          expertId: true,
          title: true,
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });
}

async function removeUnapprovedAnalysisForTranscript(transcriptId: string) {
  const oldUnapprovedTakes = await db.expertTake.findMany({
    where: {
      transcriptId,
      reviewStatus: {
        in: [...REPLACEABLE_REVIEW_STATUSES],
      },
    },
    select: {
      id: true,
      playerId: true,
    },
  });
  const oldOrphanMentions = await db.playerMention.findMany({
    where: {
      transcriptId,
      expertTakeId: null,
    },
    select: {
      id: true,
      playerId: true,
    },
  });
  const affectedPlayerIds = new Set<string>();

  for (const take of oldUnapprovedTakes) {
    if (take.playerId) affectedPlayerIds.add(take.playerId);
  }

  for (const mention of oldOrphanMentions) {
    affectedPlayerIds.add(mention.playerId);
  }

  await db.playerMention.deleteMany({
    where: {
      transcriptId,
      expertTakeId: null,
    },
  });
  await db.expertTake.deleteMany({
    where: {
      transcriptId,
      reviewStatus: {
        in: [...REPLACEABLE_REVIEW_STATUSES],
      },
    },
  });

  return {
    oldUnapprovedTakeCount: oldUnapprovedTakes.length,
    oldOrphanMentionCount: oldOrphanMentions.length,
    affectedPlayerIds: Array.from(affectedPlayerIds),
  };
}

async function removePendingDuplicatesOfApprovedTakes(transcriptId: string) {
  const approvedTakes = await db.expertTake.findMany({
    where: {
      transcriptId,
      reviewStatus: "APPROVED",
    },
    select: {
      playerId: true,
      sourceSegmentId: true,
      sentiment: true,
      takeType: true,
    },
  });

  if (approvedTakes.length === 0) return 0;

  let removed = 0;

  for (const approvedTake of approvedTakes) {
    const result = await db.expertTake.deleteMany({
      where: {
        transcriptId,
        reviewStatus: "PENDING",
        playerId: approvedTake.playerId,
        sourceSegmentId: approvedTake.sourceSegmentId,
        sentiment: approvedTake.sentiment,
        takeType: approvedTake.takeType,
      },
    });

    removed += result.count;
  }

  return removed;
}

function normalizeScope(scope: string): ReprocessScope {
  if (scope === "transcript" || scope === "sourceVideo") {
    return scope;
  }

  throw new Error("Reprocessing scope must be transcript or sourceVideo.");
}

function requireId(value: string, message: string) {
  const trimmedValue = value.trim();

  if (!trimmedValue) {
    throw new Error(message);
  }

  return trimmedValue;
}
