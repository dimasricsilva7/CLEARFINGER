import { NextResponse, type NextRequest } from "next/server";
import { safeEqual } from "@/lib/crypto";
import { db } from "@/lib/db";
import { log } from "@/lib/log";
import { runAllJobs, runCleanupJobs, runReconcileJobs } from "@/server/jobs";
import { resetAdminFromEnv } from "@/server/maintenance";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Jobs protegidos por CRON_SECRET (Authorization: Bearer ...).
 *   Rotina (Vercel Cron + GitHub Actions): /api/cron/all · reconcile · cleanup
 *   Manutenção: /api/cron/reset-admin — senha de ADMIN_EMAIL = ADMIN_PASSWORD_HASH
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ job: string }> }) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization") ?? "";
  if (!secret || !safeEqual(auth, `Bearer ${secret}`)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { job } = await params;
  const runners: Record<string, () => Promise<unknown>> = {
    all: runAllJobs,
    reconcile: runReconcileJobs,
    cleanup: runCleanupJobs,
    "reset-admin": () => resetAdminFromEnv(db),
  };
  const run = runners[job];
  if (!run) return NextResponse.json({ error: "unknown_job" }, { status: 404 });
  try {
    const result = await run();
    log.info("cron", "job executado", { job });
    return NextResponse.json({ ok: true, job, result });
  } catch (err) {
    log.error("cron", "job falhou", { job, error: err instanceof Error ? err.message : String(err) });
    return NextResponse.json({ ok: false, error: "job_failed" }, { status: 500 });
  }
}
