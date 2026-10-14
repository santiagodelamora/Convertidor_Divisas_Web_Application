import { ApiError } from "./errors.js";

const BASE_URL = process.env.FRANKFURTER_URL ?? "https://api.frankfurter.dev/v1";
const TIMEOUT_MS = 8000;

interface CacheEntry {
  expires: number;
  data: unknown;
}
const cache = new Map<string, CacheEntry>();

/** Petición GET a Frankfurter con timeout, caché en memoria y errores tipados. */
async function request<T>(path: string, ttlMs: number): Promise<T> {
  const hit = cache.get(path);
  if (hit && hit.expires > Date.now()) return hit.data as T;

  let res: Response;
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { Accept: "application/json" },
    });
  } catch (err) {
    if (err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError")) {
      throw new ApiError(504, "TIMEOUT", "La API de divisas tardó demasiado en responder.");
    }
    throw new ApiError(503, "NETWORK", "No se pudo conectar con la API de divisas.");
  }

  if (res.status === 429) {
    const retry = Number(res.headers.get("retry-after"));
    throw new ApiError(
      429,
      "RATE_LIMIT",
      "Se alcanzó el límite de peticiones de la API de divisas. Intenta de nuevo en unos instantes.",
      Number.isFinite(retry) && retry > 0 ? retry : undefined,
    );
  }
  if (res.status === 404 || res.status === 422) {
    throw new ApiError(404, "NOT_FOUND", "La API no encontró datos para esa combinación de divisas o fechas.");
  }
  if (!res.ok) {
    throw new ApiError(502, "UPSTREAM", `La API de divisas respondió con un error (${res.status}).`);
  }

  let data: unknown;
  try {
    data = await res.json();
  } catch {
    throw new ApiError(502, "EMPTY_RESPONSE", "La API de divisas devolvió una respuesta vacía o inválida.");
  }

  cache.set(path, { expires: Date.now() + ttlMs, data });
  return data as T;
}

export interface Currencies {
  [code: string]: string;
}

export async function getCurrencies(): Promise<Currencies> {
  const data = await request<Currencies>("/currencies", 24 * 60 * 60 * 1000);
  if (!data || Object.keys(data).length === 0) {
    throw new ApiError(502, "EMPTY_RESPONSE", "La API no devolvió ninguna divisa.");
  }
  return data;
}

interface LatestResponse {
  amount: number;
  base: string;
  date: string;
  rates: Record<string, number>;
}

export interface Conversion {
  from: string;
  to: string;
  amount: number;
  rate: number;
  result: number;
  date: string;
}

export async function convert(from: string, to: string, amount: number): Promise<Conversion> {
  const data = await request<LatestResponse>(`/latest?base=${from}&symbols=${to}`, 60 * 1000);
  const rate = data?.rates?.[to];
  if (typeof rate !== "number") {
    throw new ApiError(502, "EMPTY_RESPONSE", "La API no devolvió una tasa de cambio para esas divisas.");
  }
  return { from, to, amount, rate, result: amount * rate, date: data.date };
}

interface TimeseriesResponse {
  rates: Record<string, Record<string, number>>;
}

export interface HistoryPoint {
  date: string;
  rate: number;
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export async function getHistory(from: string, to: string, days: number): Promise<HistoryPoint[]> {
  const end = new Date();
  const start = new Date(end.getTime() - days * 24 * 60 * 60 * 1000);
  const data = await request<TimeseriesResponse>(
    `/${isoDate(start)}..${isoDate(end)}?base=${from}&symbols=${to}`,
    10 * 60 * 1000,
  );
  const points = Object.entries(data?.rates ?? {})
    .filter(([, r]) => typeof r?.[to] === "number")
    .map(([date, r]) => ({ date, rate: r[to] }))
    .sort((a, b) => a.date.localeCompare(b.date));
  if (points.length === 0) {
    throw new ApiError(502, "EMPTY_RESPONSE", "La API no devolvió historial para ese periodo.");
  }
  return points;
}
