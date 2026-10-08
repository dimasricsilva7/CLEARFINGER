/**
 * Logs estruturados (JSON, uma linha) — legíveis nos Runtime Logs da Vercel.
 * Campos sensíveis são mascarados automaticamente.
 */
type Level = "info" | "warn" | "error";

const SENSITIVE = /^(cpf|phone|document|email|customer|access_?token|token|authorization|api_?key|password|secret|pix|copy_?paste)$/i;

export function redact(value: unknown, depth = 0): unknown {
  if (value == null || depth > 5) return value;
  if (Array.isArray(value)) return value.map((v) => redact(v, depth + 1));
  if (typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, SENSITIVE.test(k) ? "[redacted]" : redact(v, depth + 1)])
    );
  }
  return value;
}

function emit(level: Level, scope: string, message: string, data?: Record<string, unknown>) {
  const line = JSON.stringify({ level, scope, message, ...(data ? (redact(data) as object) : {}), ts: new Date().toISOString() });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.info(line);
}

export const log = {
  info: (scope: string, message: string, data?: Record<string, unknown>) => emit("info", scope, message, data),
  warn: (scope: string, message: string, data?: Record<string, unknown>) => emit("warn", scope, message, data),
  error: (scope: string, message: string, data?: Record<string, unknown>) => emit("error", scope, message, data),
};
