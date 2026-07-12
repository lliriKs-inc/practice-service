import { randomUUID } from "node:crypto";
import { Request, Response, NextFunction } from "express";

const REQUEST_ID_PATTERN = /^[A-Za-z0-9._:-]{1,128}$/;

export function requestIdMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const headerValue = req.headers["x-request-id"];
  const suppliedRequestId = Array.isArray(headerValue)
    ? headerValue[0]
    : headerValue;

  const requestId =
    suppliedRequestId && REQUEST_ID_PATTERN.test(suppliedRequestId)
      ? suppliedRequestId
      : randomUUID();

  req.requestId = requestId;
  res.setHeader("X-Request-Id", requestId);

  next();
}