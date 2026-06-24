#!/usr/bin/env node

import "dotenv/config";
import pg from "pg";

const { Pool } = pg;
const RECENT_DAYS = 90;
const HISTORICAL_DAYS = 365;

function parseArgs() {
  const args = process.argv.slice(2);
  const targetSeasonIndex = args.indexOf("--target-season");
  const rawTargetSeason =
    targetSeasonIndex >= 0 ? args[targetSeasonIndex + 1] : undefined;
  const targetSeason = normalizeTargetSeason(rawTargetSeason);

  return { targetSeason };
}

function normalizeTargetSeason(value) {
  const currentSeason = new Date().getFullYear();
  const parsed = Number(String(value ?? "").trim());

  if (!Number.isInteger(parsed)) return currentSeason;
  if (parsed < 2000 || parsed > currentSeason + 2) return currentSeason;

  return parsed;
}

function calculateFreshness(publishDateInput, targetSeason, archived = false) {
  const publishDate = publishDateInput ? new Date(publishDateInput) : null;

  if (archived) {
    return {
      publishDate,
      contentSeason: publishDate ? publishDate.getUTCFullYear() : null,
      freshnessLabel: "ARCHIVED",
      includeInCurrentAnalysis: false,
    };
  }

  if (!publishDate || Number.isNaN(publishDate.getTime())) {
    return {
      publishDate: null,
      contentSeason: null,
      freshnessLabel: "STALE",
      includeInCurrentAnalysis: false,
    };
  }

  const targetSeasonStart = new Date(Date.UTC(targetSeason, 0, 1));
  const ageInDays = Math.floor(
    (startOfDayUtc(new Date()).getTime() - startOfDayUtc(publishDate).getTime()) /
      (1000 * 60 * 60 * 24),
  );
  let freshnessLabel;

  if (publishDate >= targetSeasonStart) {
    freshnessLabel = "CURRENT";
  } else if (ageInDays <= RECENT_DAYS) {
    freshnessLabel = "RECENT";
  } else if (ageInDays > HISTORICAL_DAYS) {
    freshnessLabel = "HISTORICAL";
  } else {
    freshnessLabel = "STALE";
  }

  return {
    publishDate,
    contentSeason: publishDate.getUTCFullYear(),
    freshnessLabel,
    includeInCurrentAnalysis:
      freshnessLabel === "CURRENT" || freshnessLabel === "RECENT",
  };
}

function startOfDayUtc(value) {
  return new Date(
    Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()),
  );
}

async function main() {
  const { targetSeason } = parseArgs();

  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required.");
  }

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 2,
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 10_000,
    allowExitOnIdle: true,
  });
  const client = await pool.connect();
  let updatedSourceVideos = 0;
  let updatedTranscripts = 0;

  try {
    const result = await client.query(`
      SELECT
        sv.id,
        sv."publishedAt",
        sv."publishDate",
        sv."freshnessLabel",
        t.id AS "transcriptId"
      FROM source_videos sv
      LEFT JOIN transcripts t ON t."sourceVideoId" = sv.id
      ORDER BY sv."createdAt" ASC
    `);

    for (const row of result.rows) {
      const freshness = calculateFreshness(
        row.publishDate ?? row.publishedAt,
        targetSeason,
        row.freshnessLabel === "ARCHIVED",
      );

      await client.query(
        `
          UPDATE source_videos
          SET
            "publishDate" = $1,
            "contentSeason" = $2,
            "freshnessLabel" = $3::"ContentFreshnessLabel",
            "includeInCurrentAnalysis" = $4,
            "updatedAt" = NOW()
          WHERE id = $5
        `,
        [
          freshness.publishDate,
          freshness.contentSeason,
          freshness.freshnessLabel,
          freshness.includeInCurrentAnalysis,
          row.id,
        ],
      );
      updatedSourceVideos += 1;

      if (row.transcriptId) {
        await client.query(
          `
            UPDATE transcripts
            SET
              "publishDate" = $1,
              "contentSeason" = $2,
              "freshnessLabel" = $3::"ContentFreshnessLabel",
              "includeInCurrentAnalysis" = $4,
              "updatedAt" = NOW()
            WHERE id = $5
          `,
          [
            freshness.publishDate,
            freshness.contentSeason,
            freshness.freshnessLabel,
            freshness.includeInCurrentAnalysis,
            row.transcriptId,
          ],
        );
        updatedTranscripts += 1;
      }
    }
  } finally {
    client.release();
    await pool.end();
  }

  console.log(
    `Backfilled freshness for target season ${targetSeason}: ${updatedSourceVideos} source videos, ${updatedTranscripts} transcripts.`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
