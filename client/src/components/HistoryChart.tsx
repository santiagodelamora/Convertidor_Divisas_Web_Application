import { useCallback, useEffect, useState } from "react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ApiClientError, fetchHistory, isAbort, toApiError, type HistoryPoint } from "../api";
import ErrorBanner from "./ErrorBanner";

const PERIODS = [
  { days: 7, label: "7 días" },
  { days: 30, label: "30 días" },
  { days: 90, label: "90 días" },
  { days: 365, label: "1 año" },
];

interface Props {
  from: string;
  to: string;
}

const fmtDate = (iso: string) =>
  new Date(iso + "T00:00:00").toLocaleDateString("es", { day: "2-digit", month: "short" });

const fmtRate = (n: number) => n.toLocaleString("es", { maximumFractionDigits: 4 });

export default function HistoryChart({ from, to }: Props) {
  const [days, setDays] = useState(30);
  const [points, setPoints] = useState<HistoryPoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ApiClientError | null>(null);
  const [attempt, setAttempt] = useState(0);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  useEffect(() => {
    if (from === to) {
      setPoints([]);
      setError(null);
      return;
    }
    const ctrl = new AbortController();
    setLoading(true);
    setError(null);
    fetchHistory(from, to, days, ctrl.signal)
      .then((data) => {
        setPoints(data);
        setLoading(false);
      })
      .catch((err) => {
        if (isAbort(err)) return;
        setPoints([]);
        setError(toApiError(err));
        setLoading(false);
      });
    return () => ctrl.abort();
  }, [from, to, days, attempt]);

  const first = points[0]?.rate;
  const last = points[points.length - 1]?.rate;
  const change = first && last ? ((last - first) / first) * 100 : null;
  const min = points.length ? Math.min(...points.map((p) => p.rate)) : null;
  const max = points.length ? Math.max(...points.map((p) => p.rate)) : null;

  return (
    <section className="card" aria-labelledby="hist-title">
      <div className="card-head">
        <h2 id="hist-title">Historial {from} → {to}</h2>
        <div className="segmented" role="group" aria-label="Periodo">
          {PERIODS.map((p) => (
            <button
              key={p.days}
              type="button"
              className={p.days === days ? "active" : ""}
              aria-pressed={p.days === days}
              onClick={() => setDays(p.days)}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {from === to && <p className="muted">Elige dos divisas distintas para ver su historial.</p>}
      {error && <ErrorBanner error={error} onRetry={retry} />}
      {loading && <p className="muted">Cargando historial…</p>}

      {points.length > 0 && !error && (
        <>
          <dl className="stats">
            <div>
              <dt>Variación</dt>
              <dd className={change != null && change >= 0 ? "up" : "down"}>
                {change != null ? `${change >= 0 ? "+" : ""}${change.toFixed(2)} %` : "—"}
              </dd>
            </div>
            <div>
              <dt>Mínimo</dt>
              <dd>{min != null ? fmtRate(min) : "—"}</dd>
            </div>
            <div>
              <dt>Máximo</dt>
              <dd>{max != null ? fmtRate(max) : "—"}</dd>
            </div>
          </dl>
          <div className="chart" aria-label={`Gráfico de la tasa ${from} a ${to}`}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={points} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
                <CartesianGrid stroke="var(--grid)" vertical={false} />
                <XAxis dataKey="date" tickFormatter={fmtDate} minTickGap={32} tick={{ fontSize: 12 }} />
                <YAxis
                  domain={["auto", "auto"]}
                  width={56}
                  tickFormatter={(v: number) => fmtRate(v)}
                  tick={{ fontSize: 12 }}
                />
                <Tooltip
                  labelFormatter={(l: string) => fmtDate(l)}
                  formatter={(v: number) => [fmtRate(v), `1 ${from}`]}
                />
                <Line type="monotone" dataKey="rate" stroke="var(--accent)" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </>
      )}
    </section>
  );
}
