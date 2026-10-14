import cors from "cors";
import express, { type ErrorRequestHandler } from "express";
import rateLimit from "express-rate-limit";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ApiError } from "./errors.js";
import { convert, getCurrencies, getHistory } from "./frankfurter.js";

const CODE_RE = /^[A-Z]{3}$/;
const ALLOWED_DAYS = [7, 30, 90, 365];

function parseCode(value: unknown, name: string): string {
  const code = String(value ?? "").toUpperCase();
  if (!CODE_RE.test(code)) {
    throw new ApiError(400, "BAD_REQUEST", `El parámetro "${name}" debe ser un código de divisa de 3 letras.`);
  }
  return code;
}

export function createApp() {
  const app = express();
  app.use(cors());

  // Límite propio para proteger tanto al servidor como a la API externa.
  app.use(
    "/api",
    rateLimit({
      windowMs: 60 * 1000,
      limit: 60,
      standardHeaders: true,
      legacyHeaders: false,
      handler: (_req, res) => {
        res.status(429).json({
          code: "RATE_LIMIT",
          message: "Demasiadas peticiones. Espera un minuto antes de volver a intentarlo.",
        });
      },
    }),
  );

  const wrap =
    (fn: express.RequestHandler): express.RequestHandler =>
    (req, res, next) => {
      Promise.resolve(fn(req, res, next)).catch(next);
    };

  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  app.get(
    "/api/currencies",
    wrap(async (_req, res) => {
      res.json(await getCurrencies());
    }),
  );

  app.get(
    "/api/convert",
    wrap(async (req, res) => {
      const from = parseCode(req.query.from, "from");
      const to = parseCode(req.query.to, "to");
      const amount = Number(req.query.amount);
      if (!Number.isFinite(amount) || amount < 0) {
        throw new ApiError(400, "BAD_REQUEST", "El parámetro \"amount\" debe ser un número mayor o igual a 0.");
      }
      if (from === to) {
        res.json({ from, to, amount, rate: 1, result: amount, date: new Date().toISOString().slice(0, 10) });
        return;
      }
      res.json(await convert(from, to, amount));
    }),
  );

  app.get(
    "/api/history",
    wrap(async (req, res) => {
      const from = parseCode(req.query.from, "from");
      const to = parseCode(req.query.to, "to");
      const days = Number(req.query.days ?? 30);
      if (!ALLOWED_DAYS.includes(days)) {
        throw new ApiError(400, "BAD_REQUEST", `El parámetro "days" debe ser uno de: ${ALLOWED_DAYS.join(", ")}.`);
      }
      if (from === to) {
        throw new ApiError(400, "BAD_REQUEST", "Elige dos divisas distintas para ver el historial.");
      }
      res.json(await getHistory(from, to, days));
    }),
  );

  app.use("/api", (_req, _res, next) => {
    next(new ApiError(404, "NOT_FOUND", "Ruta no encontrada."));
  });

  // En producción, Express sirve el cliente compilado.
  const clientDist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../client/dist");
  if (fs.existsSync(clientDist)) {
    app.use(express.static(clientDist));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(clientDist, "index.html"));
    });
  }

  const onError: ErrorRequestHandler = (err, _req, res, _next) => {
    if (err instanceof ApiError) {
      if (err.retryAfter) res.setHeader("Retry-After", String(err.retryAfter));
      res.status(err.status).json({ code: err.code, message: err.message, retryAfter: err.retryAfter });
      return;
    }
    console.error(err);
    res.status(500).json({ code: "UPSTREAM", message: "Error interno del servidor." });
  };
  app.use(onError);

  return app;
}
