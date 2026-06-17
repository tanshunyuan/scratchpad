import { AsyncLocalStorage } from "node:async_hooks";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
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

  try {
    return await logContext.run(
      {
        generationId: input.generationId,
        logFilePath,
        logger,
      },
      input.callback,
    );
  } finally {
    prependRunLogToAggregate(logFilePath);
  }
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
      { stream: pino.destination({ dest: logFilePath, sync: true }) },
    ]),
  );
}

function prependRunLogToAggregate(logFilePath: string) {
  if (logFilePath === aggregateLogFilePath || !existsSync(logFilePath)) {
    return;
  }

  const runLog = readFileSync(logFilePath, "utf8").trim();

  if (!runLog) {
    return;
  }

  const existingLog = existsSync(aggregateLogFilePath)
    ? readFileSync(aggregateLogFilePath, "utf8").trim()
    : "";

  const nextLog = existingLog ? `${runLog}\n${existingLog}\n` : `${runLog}\n`;
  writeFileSync(aggregateLogFilePath, nextLog);
}

function getLogDirectory() {
  const rootServerDirectory = path.join(process.cwd(), "server");

  if (existsSync(path.join(rootServerDirectory, "package.json"))) {
    return path.join(rootServerDirectory, "logs");
  }

  return path.join(process.cwd(), "logs");
}
