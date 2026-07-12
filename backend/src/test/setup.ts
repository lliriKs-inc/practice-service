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