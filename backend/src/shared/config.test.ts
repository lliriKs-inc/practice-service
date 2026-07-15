import { afterEach, describe, expect, it, vi } from "vitest";

const originalJwtSecret = process.env.JWT_SECRET;
const originalDatabaseUrl = process.env.DATABASE_URL;
const originalPort = process.env.PORT;
const originalCorsOrigin = process.env.CORS_ORIGIN;

afterEach(() => {
  if (originalJwtSecret === undefined) {
    delete process.env.JWT_SECRET;
  } else {
    process.env.JWT_SECRET = originalJwtSecret;
  }

  if (originalDatabaseUrl === undefined) {
    delete process.env.DATABASE_URL;
  } else {
    process.env.DATABASE_URL = originalDatabaseUrl;
  }

  if (originalPort === undefined) {
    delete process.env.PORT;
  } else {
    process.env.PORT = originalPort;
  }

  if (originalCorsOrigin === undefined) {
    delete process.env.CORS_ORIGIN;
  } else {
    process.env.CORS_ORIGIN = originalCorsOrigin;
  }

  vi.resetModules();
});

describe("environment configuration", () => {
  it("fails when JWT_SECRET is missing", async () => {
    delete process.env.JWT_SECRET;
    vi.resetModules();

    await expect(import("./config")).rejects.toThrow(
      /JWT_SECRET/
    );
  });

  it("fails when JWT_SECRET is too short", async () => {
    process.env.JWT_SECRET = "short";
    vi.resetModules();

    await expect(import("./config")).rejects.toThrow(
      /at least 32 characters/
    );
  });

  it("fails when DATABASE_URL is missing", async () => {
    delete process.env.DATABASE_URL;
    vi.resetModules();

    await expect(import("./config")).rejects.toThrow(
      /DATABASE_URL/
    );
  });

  it("parses valid environment values", async () => {
    process.env.JWT_SECRET =
      "valid-test-secret-that-is-longer-than-32-characters";
    process.env.DATABASE_URL =
      "postgresql://postgres:postgres@localhost:5432/test";
    process.env.PORT = "4321";
    process.env.CORS_ORIGIN =
      "https://practice.example.com, https://admin.example.com";

    vi.resetModules();

    const { config } = await import("./config");

    expect(config.environment).toBe("test");
    expect(config.port).toBe(4321);
    expect(config.database.url).toContain("localhost:5432/test");
    expect(config.cors.origins).toEqual([
      "https://practice.example.com",
      "https://admin.example.com",
    ]);
  });
});
