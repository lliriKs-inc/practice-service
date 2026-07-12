import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

const MAIL_ENV_KEYS = [
  "NODE_ENV",
  "DATABASE_URL",
  "JWT_SECRET",
  "MAIL_ENABLED",
  "SMTP_HOST",
  "SMTP_PORT",
  "SMTP_SECURE",
  "SMTP_USER",
  "SMTP_PASS",
  "SMTP_FROM",
] as const;

const originalEnvironment = Object.fromEntries(
  MAIL_ENV_KEYS.map((key) => [
    key,
    process.env[key],
  ])
);

function restoreEnvironment(): void {
  for (const key of MAIL_ENV_KEYS) {
    const originalValue =
      originalEnvironment[key];

    if (originalValue === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = originalValue;
    }
  }
}

describe("mail environment configuration", () => {
  beforeEach(() => {
    process.env.NODE_ENV = "test";
    process.env.DATABASE_URL =
      "postgresql://postgres:postgres@localhost:5432/test";
    process.env.JWT_SECRET =
      "valid-test-secret-that-is-longer-than-32-characters";

    process.env.MAIL_ENABLED = "false";

    delete process.env.SMTP_HOST;
    delete process.env.SMTP_USER;
    delete process.env.SMTP_PASS;
    delete process.env.SMTP_FROM;

    process.env.SMTP_PORT = "587";
    process.env.SMTP_SECURE = "false";

    vi.resetModules();
  });

  afterEach(() => {
    restoreEnvironment();
    vi.resetModules();
  });

  it("allows disabled mail in test environment", async () => {
    const { config } = await import("./config");

    expect(config.mail).toEqual({
      enabled: false,
    });
  });

  it("rejects disabled mail in production", async () => {
    process.env.NODE_ENV = "production";
    process.env.MAIL_ENABLED = "false";

    vi.resetModules();

    await expect(import("./config")).rejects.toThrow(
      /MAIL_ENABLED must be true in production/
    );
  });

  it.each([
    "SMTP_HOST",
    "SMTP_USER",
    "SMTP_PASS",
  ] as const)(
    "requires %s when mail is enabled",
    async (missingVariable) => {
      process.env.MAIL_ENABLED = "true";
      process.env.SMTP_HOST =
        "smtp.example.com";
      process.env.SMTP_USER =
        "user@example.com";
      process.env.SMTP_PASS =
        "smtp-password";

      delete process.env[missingVariable];

      vi.resetModules();

      await expect(
        import("./config")
      ).rejects.toThrow(
        new RegExp(missingVariable)
      );
    }
  );

  it("parses enabled SMTP configuration", async () => {
    process.env.MAIL_ENABLED = "true";
    process.env.SMTP_HOST =
      "smtp.example.com";
    process.env.SMTP_PORT = "465";
    process.env.SMTP_SECURE = "true";
    process.env.SMTP_USER =
      "user@example.com";
    process.env.SMTP_PASS =
      "smtp-password";
    process.env.SMTP_FROM =
      "practice@example.com";

    vi.resetModules();

    const { config } = await import("./config");

    expect(config.mail).toEqual({
      enabled: true,
      host: "smtp.example.com",
      port: 465,
      secure: true,
      user: "user@example.com",
      password: "smtp-password",
      from: "practice@example.com",
    });
  });

  it("uses SMTP_USER as the default sender", async () => {
    process.env.MAIL_ENABLED = "true";
    process.env.SMTP_HOST =
      "smtp.example.com";
    process.env.SMTP_USER =
      "user@example.com";
    process.env.SMTP_PASS =
      "smtp-password";

    delete process.env.SMTP_FROM;

    vi.resetModules();

    const { config } = await import("./config");

    expect(config.mail.enabled).toBe(true);

    if (!config.mail.enabled) {
      throw new Error(
        "Mail must be enabled in this test"
      );
    }

    expect(config.mail.from).toBe(
      "user@example.com"
    );
  });
});
