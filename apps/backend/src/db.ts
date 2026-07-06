/**
 * Singleton PrismaClient instance
 */
import { PrismaClient } from "@nomadlogs/db";
import { PrismaPg } from "@prisma/adapter-pg";
import { DATABASE_URL, NODE_ENV } from "./config/constants.js";

function createPrismaClient(): InstanceType<typeof PrismaClient> {
  const adapter = new PrismaPg(DATABASE_URL);
  const client = new PrismaClient({
    adapter,
    log: [
      { emit: "event", level: "query" },
      { emit: "stdout", level: "error" },
      { emit: "stdout", level: "warn" },
    ],
  });

  (client as any).$on("query", (e: any) => {
    if (e.duration > 250) {
      console.warn(`🐢 Slow Query [${e.duration}ms]: ${e.query} | Params: ${e.params}`);
    }
  });

  return client;
}

const globalForPrisma = globalThis as unknown as {
  prisma: InstanceType<typeof PrismaClient> | undefined;
};

export const prisma =
  globalForPrisma.prisma ?? createPrismaClient();

if (NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
