import type {
  LogEntry,
  LogSink,
} from "./logger.types";

export class ConsoleLogSink implements LogSink {
  write(entry: LogEntry): void {
    const serialized = JSON.stringify(entry);

    switch (entry.level) {
      case "error":
        console.error(serialized);
        return;

      case "warn":
        console.warn(serialized);
        return;

      default:
        console.log(serialized);
    }
  }
}
