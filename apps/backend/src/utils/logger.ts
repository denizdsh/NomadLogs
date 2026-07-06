import pino from "pino";
import { NODE_ENV } from "../config/constants.js";

const isProduction = NODE_ENV === "production";

/**
 * Structured application logger.
 * Emits JSON in production and readable colorized logs in development.
 */
export const logger = pino({
  level: process.env["LOG_LEVEL"] ?? "info",
  transport: !isProduction
    ? {
        target: "pino-pretty",
        options: {
          colorize: true,
          translateTime: "HH:MM:ss Z",
          ignore: "pid,hostname",
        },
      }
    : undefined,
});
