export type ErrorCode =
  | "BAD_REQUEST"
  | "NETWORK"
  | "TIMEOUT"
  | "RATE_LIMIT"
  | "EMPTY_RESPONSE"
  | "UPSTREAM"
  | "NOT_FOUND"
  | "OFFLINE";

export class ApiClientError extends Error {
  constructor(
    public readonly code: ErrorCode,
    message: string,
    public readonly retryAfter?: number,
  ) {
    super(message);
    this.name = "ApiClientError";
  }
}

export interface Conversion {
  from: string;
  to: string;
  amount: number;
  rate: number;
  result: number;
  date: string;
}

export interface HistoryPoint {
  date: string;
  rate: number;
}

export type Currencies = Record<string, string>;

async function get<T>(path: string, signal?: AbortSignal): Promise<T> {
  if (!navigator.onLine) {
    throw new ApiClientError("OFFLINE", "No tienes conexión a internet. Revisa tu red e inténtalo de nuevo.");
  }

  let res: Response;
  try {
    res = await fetch(path, { signal });
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") throw err;
    throw new ApiClientError("NETWORK", "No se pudo contactar con el servidor. ¿Está en ejecución?");
  }

  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    // cuerpo vacío o no JSON: se trata más abajo
  }

  if (!res.ok) {
    const e = (body ?? {}) as { code?: ErrorCode; message?: string; retryAfter?: number };
    const code: ErrorCode = e.code ?? (res.status === 429 ? "RATE_LIMIT" : "UPSTREAM");
    throw new ApiClientError(code, e.message ?? "Ocurrió un error inesperado.", e.retryAfter);
  }

  const isEmpty =
    body == null ||
    (Array.isArray(body) && body.length === 0) ||
    (typeof body === "object" && Object.keys(body as object).length === 0);
  if (isEmpty) {
    throw new ApiClientError("EMPTY_RESPONSE", "El servidor respondió sin datos. Inténtalo de nuevo más tarde.");
  }
  return body as T;
}

export const fetchCurrencies = (signal?: AbortSignal) => get<Currencies>("/api/currencies", signal);

export const fetchConversion = (from: string, to: string, amount: number, signal?: AbortSignal) =>
  get<Conversion>(`/api/convert?from=${from}&to=${to}&amount=${amount}`, signal);

export const fetchHistory = (from: string, to: string, days: number, signal?: AbortSignal) =>
  get<HistoryPoint[]>(`/api/history?from=${from}&to=${to}&days=${days}`, signal);

export function isAbort(err: unknown): boolean {
  return err instanceof DOMException && err.name === "AbortError";
}

export function toApiError(err: unknown): ApiClientError {
  return err instanceof ApiClientError
    ? err
    : new ApiClientError("UPSTREAM", "Ocurrió un error inesperado.");
}
