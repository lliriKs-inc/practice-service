process.env.NODE_ENV = "test";
process.env.PORT ??= "3000";

process.env.DATABASE_URL ??=
  "postgresql://postgres:postgres@localhost:5432/practice_test?schema=public";

process.env.JWT_SECRET ??=
  "test-jwt-secret-that-is-longer-than-32-characters";

process.env.JWT_ISSUER ??= "practice-service";
process.env.JWT_AUDIENCE ??= "practice-service-api";

process.env.CORS_ORIGIN ??= "http://localhost:3001";
process.env.JSON_BODY_LIMIT ??= "1mb";
process.env.UPLOAD_DIR ??= "uploads";
process.env.UPLOAD_MAX_FILE_SIZE_BYTES ??= "10485760";
process.env.LOG_LEVEL ??= "error";

process.env.MAIL_ENABLED ??= "false";
process.env.SMTP_PORT ??= "587";
process.env.SMTP_SECURE ??= "false";

process.env.TRUST_PROXY_HOPS ??= "0";
process.env.RATE_LIMIT_WINDOW_MS ??= "60000";
process.env.RATE_LIMIT_MAX_REQUESTS ??= "1000";
process.env.AUTH_RATE_LIMIT_WINDOW_MS ??= "60000";
process.env.AUTH_RATE_LIMIT_MAX_REQUESTS ??= "1000";