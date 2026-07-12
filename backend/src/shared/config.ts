import { z } from "zod";

const environmentSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),

  LOG_LEVEL: z
    .enum(["debug", "info", "warn", "error"])
    .default("info"),

  PORT: z.coerce
    .number()
    .int()
    .positive()
    .max(65535)
    .default(3000),

  DATABASE_URL: z
    .string()
    .min(1, "DATABASE_URL is required"),

  JWT_SECRET: z
    .string()
    .min(32, "JWT_SECRET must contain at least 32 characters"),

  JWT_ISSUER: z
    .string()
    .min(1)
    .default("practice-service"),

  JWT_AUDIENCE: z
    .string()
    .min(1)
    .default("practice-service-api"),

  CORS_ORIGIN: z
    .string()
    .min(1)
    .default("http://localhost:3001"),

  JSON_BODY_LIMIT: z
    .string()
    .min(1)
    .default("1mb"),

  TRUST_PROXY_HOPS: z.coerce
    .number()
    .int()
    .min(0)
    .max(10)
    .default(0),

  RATE_LIMIT_WINDOW_MS: z.coerce
    .number()
    .int()
    .positive()
    .default(15 * 60 * 1000),

  RATE_LIMIT_MAX_REQUESTS: z.coerce
    .number()
    .int()
    .positive()
    .default(300),

  AUTH_RATE_LIMIT_WINDOW_MS: z.coerce
    .number()
    .int()
    .positive()
    .default(15 * 60 * 1000),

  AUTH_RATE_LIMIT_MAX_REQUESTS: z.coerce
    .number()
    .int()
    .positive()
    .default(10),

  UPLOAD_DIR: z
    .string()
    .min(1)
    .default("uploads"),

  UPLOAD_MAX_FILE_SIZE_BYTES: z.coerce
    .number()
    .int()
    .positive()
    .max(100 * 1024 * 1024)
    .default(10 * 1024 * 1024),

  MAIL_ENABLED: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),

  SMTP_HOST: z
    .string()
    .min(1)
    .optional(),

  SMTP_PORT: z.coerce
    .number()
    .int()
    .positive()
    .max(65535)
    .default(587),

  SMTP_SECURE: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),

  SMTP_USER: z
    .string()
    .min(1)
    .optional(),

  SMTP_PASS: z
    .string()
    .min(1)
    .optional(),

  SMTP_FROM: z
    .string()
    .min(1)
    .optional(),
});

const result = environmentSchema.safeParse(process.env);

if (!result.success) {
  const details = result.error.issues
    .map((issue) => {
      const field = issue.path.join(".") || "environment";
      return `${field}: ${issue.message}`;
    })
    .join("; ");

  throw new Error(`Invalid environment configuration: ${details}`);
}

if (
  result.data.NODE_ENV === "production" &&
  !result.data.MAIL_ENABLED
) {
  throw new Error(
    "Invalid environment configuration: MAIL_ENABLED must be true in production"
  );
}

if (result.data.MAIL_ENABLED) {
  const requiredMailVariables = {
    SMTP_HOST: result.data.SMTP_HOST,
    SMTP_USER: result.data.SMTP_USER,
    SMTP_PASS: result.data.SMTP_PASS,
  };

  const missingMailVariables = Object.entries(
    requiredMailVariables
  )
    .filter(([, value]) => !value)
    .map(([name]) => name);

  if (missingMailVariables.length > 0) {
    throw new Error(
      `Invalid environment configuration: missing ${missingMailVariables.join(
        ", "
      )}`
    );
  }
}

export const config = {
  environment: result.data.NODE_ENV,

  logging: {
    level: result.data.LOG_LEVEL,
  },

  port: result.data.PORT,

  database: {
    url: result.data.DATABASE_URL,
  },

  jwt: {
    secret: result.data.JWT_SECRET,
    issuer: result.data.JWT_ISSUER,
    audience: result.data.JWT_AUDIENCE,
  },

  cors: {
    origin: result.data.CORS_ORIGIN,
  },

  http: {
    jsonBodyLimit: result.data.JSON_BODY_LIMIT,
  },

  security: {
    trustProxyHops:
      result.data.TRUST_PROXY_HOPS,

    rateLimit: {
      windowMilliseconds:
        result.data.RATE_LIMIT_WINDOW_MS,
      maximumRequests:
        result.data.RATE_LIMIT_MAX_REQUESTS,
    },

    authRateLimit: {
      windowMilliseconds:
        result.data.AUTH_RATE_LIMIT_WINDOW_MS,
      maximumRequests:
        result.data.AUTH_RATE_LIMIT_MAX_REQUESTS,
    },
  },

  storage: {
    uploadDir: result.data.UPLOAD_DIR,
    maxFileSizeBytes:
      result.data.UPLOAD_MAX_FILE_SIZE_BYTES,
  },

  mail: result.data.MAIL_ENABLED
    ? {
        enabled: true as const,
        host: result.data.SMTP_HOST!,
        port: result.data.SMTP_PORT,
        secure: result.data.SMTP_SECURE,
        user: result.data.SMTP_USER!,
        password: result.data.SMTP_PASS!,
        from:
          result.data.SMTP_FROM ??
          result.data.SMTP_USER!,
      }
    : {
        enabled: false as const,
      },
} as const;

export type AppConfig = typeof config;
