import "dotenv/config";
import { createApp } from "./app";
import { config } from "./shared/config";
import {
  appLogger,
} from "./shared/logger/runtime-logger";
import { prisma } from "./shared/prisma";

const app = createApp({
  logger: appLogger,
});

const server = app.listen(config.port, () => {
  appLogger.info("Server started", {
    port: config.port,
    environment: config.environment,
  });
});

let shutdownStarted = false;

async function shutdown(
  signal: string
): Promise<void> {
  if (shutdownStarted) {
    return;
  }

  shutdownStarted = true;

  appLogger.info("Server shutdown requested", {
    signal,
  });

  const forceShutdownTimer = setTimeout(() => {
    appLogger.error("Forced server shutdown", {
      signal,
      timeoutMilliseconds: 10_000,
    });

    process.exit(1);
  }, 10_000);

  forceShutdownTimer.unref();

  try {
    await new Promise<void>(
      (resolve, reject) => {
        server.close((error) => {
          if (error) {
            reject(error);
            return;
          }

          resolve();
        });
      }
    );

    await prisma.$disconnect();

    clearTimeout(forceShutdownTimer);

    appLogger.info("Server stopped", {
      signal,
    });

    process.exit(0);
  } catch (error) {
    clearTimeout(forceShutdownTimer);

    appLogger.error(
      "Failed to stop server cleanly",
      {
        signal,
        error,
      }
    );

    process.exit(1);
  }
}

process.on("SIGTERM", () => {
  void shutdown("SIGTERM");
});

process.on("SIGINT", () => {
  void shutdown("SIGINT");
});