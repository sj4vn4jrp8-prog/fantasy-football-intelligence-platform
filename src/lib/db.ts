import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { PrismaClient } from "@/generated/prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
  prismaClientCacheVersion?: string;
  prismaPgPool?: Pool;
};

const PRISMA_CLIENT_CACHE_VERSION =
  "shared-pg-pool-v5-transcript-intelligence";
const REQUIRED_MODEL_DELEGATES = [
  "leagueExternalIdentity",
  "teamExternalIdentity",
  "playerExternalIdentity",
  "expert",
  "sourceVideo",
  "transcript",
  "expertTake",
  "transcriptPlayerSummary",
  "transcriptPlayerSummaryEvidence",
  "expertTakeOutcome",
  "expertAccuracySnapshot",
] as const;
const DEFAULT_DATABASE_POOL_MAX = 3;

function getDatabasePoolMax() {
  const configuredMax = Number(process.env.DATABASE_POOL_MAX);

  return Number.isInteger(configuredMax) && configuredMax > 0
    ? configuredMax
    : DEFAULT_DATABASE_POOL_MAX;
}

function getPgPool() {
  if (globalForPrisma.prismaPgPool) {
    return globalForPrisma.prismaPgPool;
  }

  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error("DATABASE_URL is required to initialize Prisma.");
  }

  const pool = new Pool({
    connectionString,
    max: getDatabasePoolMax(),
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 10_000,
    allowExitOnIdle: true,
  });

  pool.on("error", (error) => {
    console.error("Postgres pool error", serializePoolError(error));
  });

  globalForPrisma.prismaPgPool = pool;

  return pool;
}

function createPrismaClient() {
  const adapter = new PrismaPg(getPgPool(), {
    disposeExternalPool: false,
  });

  return new PrismaClient({ adapter });
}

function cachedClientSupportsCurrentSchema(client: PrismaClient) {
  const runtimeClient = client as PrismaClient & Record<string, unknown>;

  return (
    REQUIRED_MODEL_DELEGATES.every((delegate) => runtimeClient[delegate]) &&
    modelHasField(runtimeClient.sourceVideo, "includeInCurrentAnalysis") &&
    modelHasField(runtimeClient.transcript, "includeInCurrentAnalysis")
  );
}

function modelHasField(delegate: unknown, fieldName: string) {
  const fields = (delegate as { fields?: Record<string, unknown> } | undefined)
    ?.fields;

  return Boolean(fields?.[fieldName]);
}

function getPrismaClient() {
  if (
    globalForPrisma.prisma &&
    globalForPrisma.prismaClientCacheVersion === PRISMA_CLIENT_CACHE_VERSION &&
    cachedClientSupportsCurrentSchema(globalForPrisma.prisma)
  ) {
    return globalForPrisma.prisma;
  }

  if (globalForPrisma.prisma) {
    void globalForPrisma.prisma.$disconnect().catch(() => undefined);
  }

  return createPrismaClient();
}

export const db = getPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db;
  globalForPrisma.prismaClientCacheVersion = PRISMA_CLIENT_CACHE_VERSION;
}

function serializePoolError(error: Error & { code?: string }) {
  return {
    name: error.name,
    message: error.message,
    code: error.code,
  };
}
