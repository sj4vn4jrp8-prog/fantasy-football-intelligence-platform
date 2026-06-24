import { analyzeSavedTranscript, segmentTranscriptText } from "@/knowledge-brain/analyzeTranscript";
import {
  calculateContentFreshness,
  getDefaultTargetSeason,
  getFreshnessOptions,
  normalizeTargetSeason,
  type ContentFreshnessLabel,
} from "@/knowledge-brain/freshness";
import { getPlayerIntelligenceHighlights } from "@/knowledge-brain/player-intelligence";
import {
  ManualTranscriptSource,
  TranscriptApiSource,
  YouTubeTranscriptSource,
  type ManualTranscriptInput,
} from "@/knowledge-brain/transcript-sources";
import { db } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";

const DEFAULT_EXPERTS = [
  {
    name: "Fantasy Footballers",
    slug: "fantasy-footballers",
    tags: ["podcast", "youtube", "rankings"],
    notes: "Default expert source for broad fantasy football analysis.",
  },
  {
    name: "Late Round Podcast",
    slug: "late-round-podcast",
    tags: ["podcast", "jj-zachariason", "process"],
    notes: "JJ Zachariason and Late Round process-oriented analysis.",
  },
  {
    name: "Fantasy Flock",
    slug: "fantasy-flock",
    tags: ["youtube", "rankings", "draft"],
    notes: "Default expert source for high-volume player takes.",
  },
  {
    name: "Underdog Fantasy",
    slug: "underdog-fantasy",
    tags: ["youtube", "best-ball", "market"],
    notes: "Default expert source for market-aware fantasy analysis.",
  },
  {
    name: "FantasyPros",
    slug: "fantasypros",
    tags: ["rankings", "news", "consensus"],
    notes: "Default expert source for consensus and analyst content.",
  },
] as const;

export type ManualTranscriptSummary = {
  expertName: string;
  videoTitle: string;
  segmentsCreated: number;
  takesCreated: number;
  playersMentioned: number;
};

export type MarkdownTranscriptSummary = ManualTranscriptSummary & {
  sourcePlatform: string;
  videoId?: string;
};

export type BulkMarkdownTranscriptImportItem = {
  filename: string;
  markdown: string;
};

export type BulkMarkdownTranscriptImportResult = {
  totalSubmitted: number;
  imported: number;
  skipped: number;
  failed: number;
  results: Array<
    | {
        filename: string;
        status: "IMPORTED";
        summary: MarkdownTranscriptSummary;
      }
    | {
        filename: string;
        status: "SKIPPED";
        reason: string;
      }
    | {
        filename: string;
        status: "FAILED";
        error: string;
      }
  >;
};

export type KnowledgeBrainFilters = {
  targetSeason?: number | string | null;
  freshness?: string | null;
  includeHistorical?: boolean;
};

export async function ensureDefaultExperts() {
  for (const defaultExpert of DEFAULT_EXPERTS) {
    const expert = await db.expert.upsert({
      where: { slug: defaultExpert.slug },
      create: {
        name: defaultExpert.name,
        slug: defaultExpert.slug,
        notes: defaultExpert.notes,
        tags: [...defaultExpert.tags],
      },
      update: {
        name: defaultExpert.name,
      },
    });
    const existingChannel = await db.expertChannel.findFirst({
      where: {
        expertId: expert.id,
        platform: "YOUTUBE",
      },
    });

    if (!existingChannel) {
      await db.expertChannel.create({
        data: {
          expertId: expert.id,
          platform: "YOUTUBE",
          name: defaultExpert.name,
        },
      });
    }
  }
}

export function getTranscriptSourceStatuses() {
  return [
    new ManualTranscriptSource().getStatus(),
    new YouTubeTranscriptSource().getStatus(),
    new TranscriptApiSource().getStatus(),
  ];
}

export async function getKnowledgeBrainDashboard(filters: KnowledgeBrainFilters = {}) {
  await ensureDefaultExperts();

  const filterContext = normalizeKnowledgeBrainFilters(filters);
  const transcriptFreshnessWhere = buildTranscriptFreshnessWhere(filterContext);
  const [
    experts,
    recentTranscripts,
    latestExpertTakes,
    recentMentions,
    uncategorizedTranscripts,
    ingestionRuns,
    playerIntelligenceHighlights,
    excludedContentCount,
  ] = await Promise.all([
    db.expert.findMany({
      include: {
        channels: {
          orderBy: { createdAt: "asc" },
        },
        _count: {
          select: {
            sourceVideos: true,
            expertTakes: true,
          },
        },
      },
      orderBy: { name: "asc" },
    }),
    db.transcript.findMany({
      where: transcriptFreshnessWhere,
      include: {
        sourceVideo: {
          include: {
            expert: true,
          },
        },
        _count: {
          select: {
            segments: true,
            expertTakes: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 6,
    }),
    db.expertTake.findMany({
      where: {
        transcript: {
          is: transcriptFreshnessWhere,
        },
      },
      include: {
        expert: true,
        player: true,
        sourceVideo: true,
      },
      orderBy: { createdAt: "desc" },
      take: 12,
    }),
    db.playerMention.findMany({
      where: {
        transcript: {
          is: transcriptFreshnessWhere,
        },
      },
      include: {
        player: true,
      },
      orderBy: { createdAt: "desc" },
      take: 250,
    }),
    db.transcript.findMany({
      where: {
        ...transcriptFreshnessWhere,
        OR: [
          { expertTakes: { none: {} } },
          { expertTakes: { some: { takeType: "UNCATEGORIZED" } } },
        ],
      },
      include: {
        sourceVideo: {
          include: {
            expert: true,
          },
        },
        _count: {
          select: {
            expertTakes: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 6,
    }),
    db.brainIngestionRun.findMany({
      include: {
        expert: true,
      },
      orderBy: { startedAt: "desc" },
      take: 6,
    }),
    getPlayerIntelligenceHighlights(filterContext),
    db.transcript.count({
      where: {
        includeInCurrentAnalysis: false,
        freshnessLabel: {
          in: ["STALE", "HISTORICAL", "ARCHIVED"],
        },
      },
    }),
  ]);

  return {
    experts,
    sourceStatuses: getTranscriptSourceStatuses(),
    filters: {
      targetSeason: filterContext.targetSeason,
      freshness: filterContext.freshness,
      includeHistorical: filterContext.includeHistorical,
      freshnessOptions: getFreshnessOptions(),
    },
    recentTranscripts,
    latestExpertTakes,
    mostMentionedPlayers: getMostMentionedPlayers(recentMentions),
    bullishPlayers: playerIntelligenceHighlights.topBullishPlayers,
    bearishPlayers: playerIntelligenceHighlights.topBearishPlayers,
    playerIntelligenceHighlights,
    uncategorizedTranscripts,
    ingestionRuns,
    excludedContentCount,
  };
}

export async function ingestManualTranscript(input: ManualTranscriptInput) {
  const source = new ManualTranscriptSource();
  const normalizedInput = source.normalizeInput(input);

  if (!normalizedInput.expertId) {
    throw new Error("Select an expert before saving a transcript.");
  }

  if (!normalizedInput.title) {
    throw new Error("Video title is required.");
  }

  if (!normalizedInput.url) {
    throw new Error("Video URL is required.");
  }

  if (!normalizedInput.publishedAt) {
    throw new Error("Publish date is required.");
  }

  if (!normalizedInput.transcript) {
    throw new Error("Transcript text is required.");
  }

  const expert = await db.expert.findUnique({
    where: { id: normalizedInput.expertId },
  });

  if (!expert) {
    throw new Error("Selected expert was not found.");
  }

  const run = await db.brainIngestionRun.create({
    data: {
      expertId: expert.id,
      source: "MANUAL",
      status: "RUNNING",
      itemsFound: 1,
      message: "Manual transcript ingestion started.",
    },
  });

  try {
    const segments = segmentTranscriptText(normalizedInput.transcript);
    const freshness = calculateContentFreshness(normalizedInput.publishedAt, {
      targetSeason: getDefaultTargetSeason(),
    });
    const sourceVideo = await db.sourceVideo.create({
      data: {
        expertId: expert.id,
        title: normalizedInput.title,
        url: normalizedInput.url,
        sourceType: "MANUAL",
        publishedAt: normalizedInput.publishedAt,
        publishDate: freshness.publishDate,
        contentSeason: freshness.contentSeason,
        freshnessLabel: freshness.freshnessLabel,
        includeInCurrentAnalysis: freshness.includeInCurrentAnalysis,
        sourceTimestamp: normalizedInput.publishedAt ?? new Date(),
      },
    });
    const transcript = await db.transcript.create({
      data: {
        sourceVideoId: sourceVideo.id,
        sourceType: "MANUAL",
        rawText: normalizedInput.transcript,
        wordCount: countWords(normalizedInput.transcript),
        publishDate: freshness.publishDate,
        contentSeason: freshness.contentSeason,
        freshnessLabel: freshness.freshnessLabel,
        includeInCurrentAnalysis: freshness.includeInCurrentAnalysis,
        segments: {
          create: segments.map((segment, index) => ({
            index,
            text: segment,
          })),
        },
      },
    });
    const analysis = await analyzeSavedTranscript({
      expertId: expert.id,
      sourceVideoId: sourceVideo.id,
      transcriptId: transcript.id,
    });

    await db.brainIngestionRun.update({
      where: { id: run.id },
      data: {
        status: "COMPLETED",
        completedAt: new Date(),
        transcriptsSaved: 1,
        takesCreated: analysis.takesCreated,
        message: "Manual transcript ingestion completed.",
      },
    });

    return {
      expertName: expert.name,
      videoTitle: sourceVideo.title,
      segmentsCreated: segments.length,
      takesCreated: analysis.takesCreated,
      playersMentioned: analysis.playersMentioned,
    } satisfies ManualTranscriptSummary;
  } catch (error) {
    await db.brainIngestionRun.update({
      where: { id: run.id },
      data: {
        status: "FAILED",
        completedAt: new Date(),
        message: error instanceof Error ? error.message : "Ingestion failed.",
      },
    });

    throw error;
  }
}

export async function ingestMarkdownTranscript(markdown: string) {
  await ensureDefaultExperts();

  const parsed = parseMarkdownTranscript(markdown);

  if (!parsed.transcript) {
    throw new Error("Markdown transcript text is required.");
  }

  const expert = await findOrCreateExpertByName(parsed.expertName);
  const sourceType = getSourceTypeFromPlatform(parsed.sourcePlatform);
  const existingSourceVideo = await findExistingMarkdownSourceVideo({
    sourceType,
    videoId: parsed.videoId,
    url: parsed.url,
  });
  const run = await db.brainIngestionRun.create({
    data: {
      expertId: expert.id,
      source: sourceType,
      status: "RUNNING",
      itemsFound: 1,
      message: "Markdown transcript import started from user-provided local content.",
      metadata: {
        sourcePlatform: parsed.sourcePlatform,
        videoId: parsed.videoId,
      },
    },
  });

  try {
    if (existingSourceVideo) {
      await db.sourceVideo.delete({
        where: { id: existingSourceVideo.id },
      });
    }

    const channel = await findOrCreateMarkdownChannel({
      expertId: expert.id,
      channelName: parsed.channel,
      sourcePlatform: parsed.sourcePlatform,
    });
    const segments = segmentTranscriptText(parsed.transcript);
    const freshness = calculateContentFreshness(parsed.publishedAt, {
      targetSeason: getDefaultTargetSeason(),
    });
    const sourceVideo = await db.sourceVideo.create({
      data: {
        expertId: expert.id,
        channelId: channel?.id,
        title: parsed.title,
        url: parsed.url,
        externalId: parsed.videoId,
        sourceType,
        publishedAt: parsed.publishedAt,
        publishDate: freshness.publishDate,
        contentSeason: freshness.contentSeason,
        freshnessLabel: freshness.freshnessLabel,
        includeInCurrentAnalysis: freshness.includeInCurrentAnalysis,
        sourceTimestamp: parsed.publishedAt ?? new Date(),
      },
    });
    const transcript = await db.transcript.create({
      data: {
        sourceVideoId: sourceVideo.id,
        sourceType,
        rawText: parsed.transcript,
        wordCount: countWords(parsed.transcript),
        publishDate: freshness.publishDate,
        contentSeason: freshness.contentSeason,
        freshnessLabel: freshness.freshnessLabel,
        includeInCurrentAnalysis: freshness.includeInCurrentAnalysis,
        segments: {
          create: segments.map((segment, index) => ({
            index,
            text: segment,
          })),
        },
      },
    });
    const analysis = await analyzeSavedTranscript({
      expertId: expert.id,
      sourceVideoId: sourceVideo.id,
      transcriptId: transcript.id,
    });

    await db.brainIngestionRun.update({
      where: { id: run.id },
      data: {
        status: "COMPLETED",
        completedAt: new Date(),
        transcriptsSaved: 1,
        takesCreated: analysis.takesCreated,
        message: "Markdown transcript import completed.",
      },
    });

    return {
      expertName: expert.name,
      videoTitle: sourceVideo.title,
      segmentsCreated: segments.length,
      takesCreated: analysis.takesCreated,
      playersMentioned: analysis.playersMentioned,
      sourcePlatform: parsed.sourcePlatform,
      videoId: parsed.videoId,
    } satisfies MarkdownTranscriptSummary;
  } catch (error) {
    await db.brainIngestionRun.update({
      where: { id: run.id },
      data: {
        status: "FAILED",
        completedAt: new Date(),
        message:
          error instanceof Error ? error.message : "Markdown import failed.",
      },
    });

    throw error;
  }
}

export async function ingestBulkMarkdownTranscripts(
  items: BulkMarkdownTranscriptImportItem[],
): Promise<BulkMarkdownTranscriptImportResult> {
  await ensureDefaultExperts();

  const results: BulkMarkdownTranscriptImportResult["results"] = [];

  for (const item of items) {
    try {
      const parsed = parseMarkdownTranscript(item.markdown);
      const sourceType = getSourceTypeFromPlatform(parsed.sourcePlatform);
      const existingSourceVideo = await findExistingMarkdownSourceVideo({
        sourceType,
        videoId: parsed.videoId,
        url: parsed.url,
      });

      if (existingSourceVideo) {
        results.push({
          filename: item.filename,
          status: "SKIPPED",
          reason: parsed.videoId
            ? `Already imported video ID ${parsed.videoId}.`
            : "Already imported transcript with this URL.",
        });
        continue;
      }

      const summary = await ingestMarkdownTranscript(item.markdown);

      results.push({
        filename: item.filename,
        status: "IMPORTED",
        summary,
      });
    } catch (error) {
      results.push({
        filename: item.filename,
        status: "FAILED",
        error:
          error instanceof Error
            ? error.message
            : "Markdown transcript could not be imported.",
      });
    }
  }

  return {
    totalSubmitted: items.length,
    imported: results.filter((result) => result.status === "IMPORTED").length,
    skipped: results.filter((result) => result.status === "SKIPPED").length,
    failed: results.filter((result) => result.status === "FAILED").length,
    results,
  };
}

export async function updateExpertSettings({
  expertId,
  active,
  channelUrl,
  notes,
  tags,
}: {
  expertId: string;
  active: boolean;
  channelUrl?: string;
  notes?: string;
  tags?: string;
}) {
  const expert = await db.expert.update({
    where: { id: expertId },
    data: {
      active,
      notes: normalizeOptionalText(notes),
      tags: parseTags(tags),
    },
    include: {
      channels: {
        orderBy: { createdAt: "asc" },
      },
    },
  });
  const primaryChannel = expert.channels[0];

  if (primaryChannel) {
    await db.expertChannel.update({
      where: { id: primaryChannel.id },
      data: {
        url: normalizeOptionalText(channelUrl),
      },
    });
  } else {
    await db.expertChannel.create({
      data: {
        expertId: expert.id,
        platform: "YOUTUBE",
        name: expert.name,
        url: normalizeOptionalText(channelUrl),
      },
    });
  }

  return { expertName: expert.name };
}

export async function createTranscriptDiscoveryScaffoldRun() {
  const youtubeSource = new YouTubeTranscriptSource();
  const status = youtubeSource.getStatus();

  await db.brainIngestionRun.create({
    data: {
      source: "YOUTUBE",
      status: "SCAFFOLDED",
      completedAt: new Date(),
      message: status.message,
      metadata: {
        active: status.active,
      },
    },
  });

  return status;
}

export async function backfillKnowledgeBrainFreshness(
  filters: KnowledgeBrainFilters = {},
) {
  const targetSeason = normalizeTargetSeason(filters.targetSeason);
  const sourceVideos = await db.sourceVideo.findMany({
    include: {
      transcript: true,
    },
    orderBy: { createdAt: "asc" },
  });
  let updatedSourceVideos = 0;
  let updatedTranscripts = 0;

  for (const sourceVideo of sourceVideos) {
    const archived = sourceVideo.freshnessLabel === "ARCHIVED";
    const freshness = calculateContentFreshness(
      sourceVideo.publishDate ?? sourceVideo.publishedAt,
      {
        targetSeason,
        archived,
      },
    );

    await db.sourceVideo.update({
      where: { id: sourceVideo.id },
      data: {
        publishDate: freshness.publishDate,
        contentSeason: freshness.contentSeason,
        freshnessLabel: freshness.freshnessLabel,
        includeInCurrentAnalysis: freshness.includeInCurrentAnalysis,
      },
    });
    updatedSourceVideos += 1;

    if (sourceVideo.transcript) {
      await db.transcript.update({
        where: { id: sourceVideo.transcript.id },
        data: {
          publishDate: freshness.publishDate,
          contentSeason: freshness.contentSeason,
          freshnessLabel: freshness.freshnessLabel,
          includeInCurrentAnalysis: freshness.includeInCurrentAnalysis,
        },
      });
      updatedTranscripts += 1;
    }
  }

  return {
    targetSeason,
    updatedSourceVideos,
    updatedTranscripts,
  };
}

function normalizeKnowledgeBrainFilters(filters: KnowledgeBrainFilters) {
  const targetSeason = normalizeTargetSeason(filters.targetSeason);
  const freshness = normalizeFreshnessFilter(filters.freshness);

  return {
    targetSeason,
    freshness,
    includeHistorical: Boolean(filters.includeHistorical),
  };
}

function buildTranscriptFreshnessWhere({
  targetSeason,
  freshness,
  includeHistorical,
}: {
  targetSeason: number;
  freshness: "ALL" | ContentFreshnessLabel;
  includeHistorical: boolean;
}): Prisma.TranscriptWhereInput {
  const freshnessWhere: Prisma.TranscriptWhereInput = {};

  if (!includeHistorical) {
    freshnessWhere.includeInCurrentAnalysis = true;
  }

  if (freshness !== "ALL") {
    freshnessWhere.freshnessLabel = freshness;
  }

  if (!includeHistorical && freshness === "CURRENT") {
    freshnessWhere.contentSeason = targetSeason;
  }

  return freshnessWhere;
}

function normalizeFreshnessFilter(value?: string | null) {
  const normalizedValue = String(value ?? "ALL").toUpperCase();
  const options = new Set<string>(["ALL", ...getFreshnessOptions()]);

  if (options.has(normalizedValue)) {
    return normalizedValue as "ALL" | ContentFreshnessLabel;
  }

  return "ALL" as const;
}

function parseMarkdownTranscript(markdown: string) {
  const trimmedMarkdown = markdown.trim();

  if (!trimmedMarkdown) {
    throw new Error("Paste a Markdown transcript before importing.");
  }

  const { metadata, content } = extractMarkdownMetadata(trimmedMarkdown);
  const title =
    getMetadataValue(metadata, "title") ??
    extractMarkdownTitle(content) ??
    "Imported Markdown Transcript";
  const transcript = stripLeadingMarkdownTitle(content).trim();
  const expertName =
    getMetadataValue(metadata, "expert") ??
    getMetadataValue(metadata, "source name") ??
    getMetadataValue(metadata, "expert/source name") ??
    getMetadataValue(metadata, "channel/podcast") ??
    getMetadataValue(metadata, "channel") ??
    "Imported Expert";
  const channel =
    getMetadataValue(metadata, "channel") ??
    getMetadataValue(metadata, "channel/podcast") ??
    undefined;
  const sourcePlatform =
    getMetadataValue(metadata, "source platform") ??
    getMetadataValue(metadata, "source_platform") ??
    "Local Markdown";
  const publishedAt = parseOptionalDate(
    getMetadataValue(metadata, "date") ??
      getMetadataValue(metadata, "published at") ??
      getMetadataValue(metadata, "published_at"),
  );

  return {
    expertName,
    channel,
    title,
    publishedAt,
    runtime: getMetadataValue(metadata, "runtime"),
    url: getMetadataValue(metadata, "url"),
    videoId:
      getMetadataValue(metadata, "video id") ??
      getMetadataValue(metadata, "video_id") ??
      extractVideoId(getMetadataValue(metadata, "url")),
    sourcePlatform,
    transcript,
  };
}

function extractMarkdownMetadata(markdown: string) {
  if (markdown.startsWith("---")) {
    const closingMarkerIndex = markdown.indexOf("\n---", 3);

    if (closingMarkerIndex > -1) {
      const frontMatter = markdown.slice(3, closingMarkerIndex).trim();
      const content = markdown.slice(closingMarkerIndex + 4).trim();

      return {
        metadata: parseMetadataLines(frontMatter.split(/\r?\n/)),
        content,
      };
    }
  }

  const lines = markdown.split(/\r?\n/);
  const separatorIndex = lines.findIndex((line, index) => {
    return index > 0 && line.trim() === "---";
  });
  const metadataLines =
    separatorIndex > -1 ? lines.slice(0, separatorIndex) : lines.slice(0, 30);
  const content =
    separatorIndex > -1
      ? lines.slice(separatorIndex + 1).join("\n")
      : markdown;

  return {
    metadata: parseMetadataLines(metadataLines),
    content: content.trim(),
  };
}

function parseMetadataLines(lines: string[]) {
  const metadata = new Map<string, string>();

  for (const line of lines) {
    const normalizedLine = line.trim();
    const yamlMatch = normalizedLine.match(/^([A-Za-z0-9_ /-]+):\s*(.+)$/);
    const bulletMatch = normalizedLine.match(
      /^-\s*\*\*([^*]+):\*\*\s*(.+)$/,
    );
    const match = yamlMatch ?? bulletMatch;

    if (!match) continue;

    metadata.set(normalizeMetadataKey(match[1]), stripMetadataQuotes(match[2]));
  }

  return metadata;
}

function getMetadataValue(metadata: Map<string, string>, key: string) {
  return metadata.get(normalizeMetadataKey(key));
}

function normalizeMetadataKey(key: string) {
  return key.toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
}

function stripMetadataQuotes(value: string) {
  const trimmed = value.trim();

  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }

  return trimmed;
}

function extractMarkdownTitle(markdown: string) {
  return markdown.match(/^#\s+(.+)$/m)?.[1]?.trim();
}

function stripLeadingMarkdownTitle(markdown: string) {
  return markdown.replace(/^#\s+.+\r?\n+/, "");
}

async function findOrCreateExpertByName(name: string) {
  const slug = slugify(name);
  const experts = await db.expert.findMany();
  const existingExpert = experts.find(
    (expert) =>
      slugify(expert.name) === slug || (expert.slug && expert.slug === slug),
  );

  if (existingExpert) {
    return existingExpert;
  }

  return db.expert.create({
    data: {
      name,
      slug,
      notes: "Created from imported Markdown transcript metadata.",
      tags: ["markdown-import"],
    },
  });
}

async function findExistingMarkdownSourceVideo({
  sourceType,
  videoId,
  url,
}: {
  sourceType: "MANUAL" | "YOUTUBE" | "TRANSCRIPT_API";
  videoId?: string;
  url?: string;
}) {
  if (videoId) {
    return db.sourceVideo.findFirst({
      where: {
        sourceType,
        externalId: videoId,
      },
    });
  }

  if (url) {
    return db.sourceVideo.findFirst({
      where: { url },
    });
  }

  return null;
}

async function findOrCreateMarkdownChannel({
  expertId,
  channelName,
  sourcePlatform,
}: {
  expertId: string;
  channelName?: string;
  sourcePlatform: string;
}) {
  if (!channelName) return null;

  const platform = sourcePlatform.toLowerCase().includes("youtube")
    ? "YOUTUBE"
    : "OTHER";
  const existingChannel = await db.expertChannel.findFirst({
    where: {
      expertId,
      platform,
      name: channelName,
    },
  });

  if (existingChannel) return existingChannel;

  return db.expertChannel.create({
    data: {
      expertId,
      platform,
      name: channelName,
    },
  });
}

function getSourceTypeFromPlatform(platform: string) {
  const normalizedPlatform = platform.toLowerCase();

  if (normalizedPlatform.includes("youtube")) return "YOUTUBE" as const;
  if (normalizedPlatform.includes("api")) return "TRANSCRIPT_API" as const;

  return "MANUAL" as const;
}

function parseOptionalDate(value?: string) {
  if (!value) return null;

  const parsedDate = new Date(value);

  return Number.isNaN(parsedDate.getTime()) ? null : parsedDate;
}

function extractVideoId(url?: string) {
  if (!url) return undefined;

  const match = url.match(
    /(?:v=|\/v\/|youtu\.be\/|\/shorts\/|\/live\/|\/embed\/)([A-Za-z0-9_-]{11})/,
  );

  return match?.[1];
}

function slugify(value: string) {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "imported-expert"
  );
}

function getMostMentionedPlayers(
  mentions: Array<{
    player: {
      id: string;
      fullName: string;
      position: string;
      team: string | null;
    };
  }>,
) {
  const mentionCounts = new Map<
    string,
    {
      player: {
        id: string;
        fullName: string;
        position: string;
        team: string | null;
      };
      count: number;
    }
  >();

  for (const mention of mentions) {
    const existing = mentionCounts.get(mention.player.id);

    mentionCounts.set(mention.player.id, {
      player: mention.player,
      count: (existing?.count ?? 0) + 1,
    });
  }

  return Array.from(mentionCounts.values())
    .sort(
      (playerA, playerB) =>
        playerB.count - playerA.count ||
        playerA.player.fullName.localeCompare(playerB.player.fullName),
    )
    .slice(0, 8);
}

function countWords(value: string) {
  return value.trim().split(/\s+/).filter(Boolean).length;
}

function normalizeOptionalText(value?: string) {
  const trimmed = value?.trim();

  return trimmed ? trimmed : null;
}

function parseTags(value?: string) {
  return (
    value
      ?.split(",")
      .map((tag) => tag.trim())
      .filter(Boolean) ?? []
  );
}
