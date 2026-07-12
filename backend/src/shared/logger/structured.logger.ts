import { ConsoleLogSink } from "./console-log.sink";
import {
  sanitizeLogContext,
} from "./safe-serialize";
import type {
  LogContext,
  LogEntry,
  Logger,
  LogLevel,
  LogSink,
} from "./logger.types";

const LEVEL_PRIORITY: Readonly<
  Record<LogLevel, number>
> = Object.freeze({
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
});

export interface StructuredLoggerOptions {
  level?: LogLevel;
  sink?: LogSink;
  now?: () => Date;
}

export class StructuredLogger implements Logger {
  private readonly level: LogLevel;
  private readonly sink: LogSink;
  private readonly now: () => Date;

  constructor(
    options: StructuredLoggerOptions = {}
  ) {
    this.level = options.level ?? "info";
    this.sink =
      options.sink ?? new ConsoleLogSink();
    this.now = options.now ?? (() => new Date());
  }

  debug(
    message: string,
    context: LogContext = {}
  ): void {
    this.write("debug", message, context);
  }

  info(
    message: string,
    context: LogContext = {}
  ): void {
    this.write("info", message, context);
  }

  warn(
    message: string,
    context: LogContext = {}
  ): void {
    this.write("warn", message, context);
  }

  error(
    message: string,
    context: LogContext = {}
  ): void {
    this.write("error", message, context);
  }

  private write(
    level: LogLevel,
    message: string,
    context: LogContext
  ): void {
    if (
      LEVEL_PRIORITY[level] <
      LEVEL_PRIORITY[this.level]
    ) {
      return;
    }

    const entry: LogEntry = {
      timestamp: this.now().toISOString(),
      level,
      message,
      context: sanitizeLogContext(context),
    };

    this.sink.write(entry);
  }
}
