export const LOG_LEVELS = Object.freeze([
  "debug",
  "info",
  "warn",
  "error",
] as const);

export type LogLevel =
  (typeof LOG_LEVELS)[number];

export type LogContext =
  Readonly<Record<string, unknown>>;

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context: LogContext;
}

export interface Logger {
  debug(
    message: string,
    context?: LogContext
  ): void;

  info(
    message: string,
    context?: LogContext
  ): void;

  warn(
    message: string,
    context?: LogContext
  ): void;

  error(
    message: string,
    context?: LogContext
  ): void;
}

export interface LogSink {
  write(entry: LogEntry): void;
}
