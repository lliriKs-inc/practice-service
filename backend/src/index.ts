import "dotenv/config";
import { createApp } from "./app";
import { config } from "./shared/config";

const app = createApp();

const server = app.listen(config.port, () => {
  console.log({
    level: "info",
    message: "Server started",
    port: config.port,
    environment: config.environment,
  });
});

function shutdown(signal: string) {
  console.log({
    level: "info",
    message: "Server shutdown requested",
    signal,
  });

  server.close((error) => {
    if (error) {
      console.error({
        level: "error",
        message: "Failed to close HTTP server",
        error,
      });

      process.exit(1);
    }

    process.exit(0);
  });
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
