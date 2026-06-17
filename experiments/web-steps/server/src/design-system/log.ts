import path from "node:path";
import pino from "pino";

const logDirectory = path.join(process.cwd(), "logs");

function getTimestampedLogFilePath() {
  const timestamp = new Date().toISOString().replaceAll(":", "-");
  return path.join(logDirectory, `design-system-${timestamp}.log`);
}

function createLogger(logFilePath: string) {
  return pino({
    level: "info",
    base: undefined,
    timestamp: pino.stdTimeFunctions.isoTime,
    transport: {
      targets: [
        {
          target: "pino/file",
          options: { destination: 1 },
        },
        {
          target: "pino/file",
          options: {
            destination: logFilePath,
            mkdir: true,
          },
        },
      ],
    },
  });
}

export let designSystemLogFilePath = getTimestampedLogFilePath();
export let designSystemLogger = createLogger(designSystemLogFilePath);

export function startDesignSystemGenerationLog() {
  designSystemLogFilePath = getTimestampedLogFilePath();
  designSystemLogger = createLogger(designSystemLogFilePath);

  return designSystemLogFilePath;
}

export function logDesignSystem(message: string, data?: Record<string, unknown>) {
  designSystemLogger.info(data ?? {}, `[design-system] ${message}`);
}
