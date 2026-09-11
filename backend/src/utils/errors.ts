import { Request, Response, NextFunction } from "express";

export class AppError extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export const notFound = (msg = "Resource not found") =>
  new AppError(404, "NOT_FOUND", msg);
export const forbidden = (msg = "Not allowed to access this resource") =>
  new AppError(403, "FORBIDDEN", msg);
export const unauthorized = (msg = "Authentication required") =>
  new AppError(401, "UNAUTHORIZED", msg);
export const badRequest = (msg = "Invalid request") =>
  new AppError(400, "BAD_REQUEST", msg);

// Wrap async route handlers so rejected promises reach the error middleware
// instead of crashing the process or hanging the request.
export const asyncHandler =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>) =>
  (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };

// Every error response has the same shape. Stack traces never leave the server.
export function errorMiddleware(
  err: unknown,
  _req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction
) {
  if (err instanceof AppError) {
    return res.status(err.status).json({
      error: { code: err.code, message: err.message },
    });
  }
  console.error(err);
  return res.status(500).json({
    error: { code: "INTERNAL_ERROR", message: "Something went wrong" },
  });
}
