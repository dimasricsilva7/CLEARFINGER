import { PrismaClient } from "@prisma/client";

// Os bytes das imagens (MediaAsset.data) nunca são carregados por padrão —
// só a rota /media/[id] os pede explicitamente com `select: { data: true }`.
const createClient = () =>
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
    omit: { mediaAsset: { data: true } },
  });

const globalForPrisma = globalThis as unknown as { prisma?: ReturnType<typeof createClient> };

export const db = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
