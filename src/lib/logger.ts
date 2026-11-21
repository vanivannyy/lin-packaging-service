// Logger terstruktur (satu baris JSON) - mudah dicari di log Vercel. Tidak menulis data sensitif.
type Level = "error" | "warn" | "info";

function serializeError(error: unknown) {
  if (error instanceof Error) return { name: error.name, message: error.message, stack: error.stack };
  return { message: String(error) };
}

function write(level: Level, message: string, context?: Record<string, unknown>, error?: unknown) {
  const line = JSON.stringify({
    level,
    message,
    time: new Date().toISOString(),
    ...(context ? { context } : {}),
    ...(error !== undefined ? { error: serializeError(error) } : {}),
  });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

export const logger = {
  error: (message: string, error?: unknown, context?: Record<string, unknown>) => write("error", message, context, error),
  warn: (message: string, context?: Record<string, unknown>) => write("warn", message, context),
  info: (message: string, context?: Record<string, unknown>) => write("info", message, context),
};
