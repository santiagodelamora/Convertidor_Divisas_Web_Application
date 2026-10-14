export type ErrorCode =
  | "BAD_REQUEST"
  | "NETWORK"
  | "TIMEOUT"
  | "RATE_LIMIT"
  | "EMPTY_RESPONSE"
  | "UPSTREAM"
  | "NOT_FOUND";

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: ErrorCode,
    message: string,
    public readonly retryAfter?: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}
