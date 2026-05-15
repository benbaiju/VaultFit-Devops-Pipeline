import pino from "pino";

function resolveLevel(): pino.LevelOrString {
  if (process.env.LOG_LEVEL) return process.env.LOG_LEVEL;
  if (process.env.NODE_ENV === "test" || process.env.JEST_WORKER_ID !== undefined) return "silent";
  if (process.env.NODE_ENV === "production") return "info";
  return "debug";
}

const nodeEnv = process.env.NODE_ENV ?? "development";
const usePretty =
  nodeEnv !== "production" && nodeEnv !== "test" && process.env.LOG_PRETTY !== "0";

export const logger = pino({
  level: resolveLevel(),
  base: { service: "vaultfit-api" },
  ...(usePretty
    ? {
        transport: {
          target: "pino-pretty",
          options: { colorize: true, translateTime: "SYS:standard", singleLine: true },
        },
      }
    : {}),
});

export function createModuleLogger(layer: string, module: string) {
  return logger.child({ layer, module });
}
