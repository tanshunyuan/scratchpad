import { pino } from "pino";

export const loggerConfig = {};

export const logger = pino({
  level: "debug",
  transport: {
    target: "pino-pretty",
    options: {
      translateTime: "HH:MM:ss Z",
      ignore: "pid,hostname",
    },
  },
});
