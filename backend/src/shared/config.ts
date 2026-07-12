import { z } from "zod";

const environmentSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),

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

export const config = {
  environment: result.data.NODE_ENV,
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

  storage: {
    uploadDir: result.data.UPLOAD_DIR,
    maxFileSizeBytes:
      result.data.UPLOAD_MAX_FILE_SIZE_BYTES,
  },
} as const;

export type AppConfig = typeof config;