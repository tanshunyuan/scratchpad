import { AsyncLocalStorage } from "node:async_hooks";
import { existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import pino, { type Logger } from "pino";

const logDirectory = getLogDirectory();
const aggregateLogFilePath = path.join(logDirectory, "design-system.log");

mkdirSync(logDirectory, { recursive: true });

const aggregateLogger = createLogger(aggregateLogFilePath);

const logContext = new AsyncLocalStorage<{
  generationId: string;
  logFilePath: string;
  logger: Logger;
}>();

export async function withDesignSystemGenerationLog<T>(input: {
  generationId: string;
  callback: () => Promise<T>;
}) {
  const logFilePath = path.join(
    logDirectory,
    `design-system-${input.generationId}.log`,
  );
  const logger = createLogger(logFilePath);

  return logContext.run(
    {
      generationId: input.generationId,
      logFilePath,
      logger,
    },
    input.callback,
  );
}

export function logDesignSystem(message: string, data?: Record<string, unknown>) {
  const context = logContext.getStore();
  const logger = context?.logger ?? aggregateLogger;

  logger.info(
    {
      ...(data ?? {}),
      ...(context
        ? {
            generationId: context.generationId,
            logFilePath: context.logFilePath,
          }
        : {}),
    },
    `[design-system] ${message}`,
  );
}

function createLogger(logFilePath: string) {
  return pino(
    {
      level: "info",
      base: undefined,
      timestamp: pino.stdTimeFunctions.isoTime,
    },
    pino.multistream([
      { stream: process.stdout },
      { stream: pino.destination({ dest: logFilePath, sync: false }) },
    ]),
  );
}

function getLogDirectory() {
  const rootServerDirectory = path.join(process.cwd(), "server");

  if (existsSync(path.join(rootServerDirectory, "package.json"))) {
    return path.join(rootServerDirectory, "logs");
  }

  return path.join(process.cwd(), "logs");
}
