import { useCallback, useEffect, useState } from "react";
import {
  ApiClientError,
  fetchConversion,
  fetchCurrencies,
  isAbort,
  toApiError,
  type Conversion,
  type Currencies,
} from "./api";
import ErrorBanner from "./components/ErrorBanner";
import HistoryChart from "./components/HistoryChart";

function useOnline() {
  const [online, setOnline] = useState(navigator.onLine);
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);
  return online;
}

export default function App() {
  const online = useOnline();
  const [currencies, setCurrencies] = useState<Currencies>({});
  const [currenciesError, setCurrenciesError] = useState<ApiClientError | null>(null);
  const [loadAttempt, setLoadAttempt] = useState(0);

  const [amount, setAmount] = useState("100");
  const [from, setFrom] = useState("USD");
  const [to, setTo] = useState("EUR");

  const [conversion, setConversion] = useState<Conversion | null>(null);
  const [convError, setConvError] = useState<ApiClientError | null>(null);
  const [converting, setConverting] = useState(false);
  const [convAttempt, setConvAttempt] = useState(0);

  // Carga de la lista de divisas.
  useEffect(() => {
    const ctrl = new AbortController();
    setCurrenciesError(null);
    fetchCurrencies(ctrl.signal)
      .then(setCurrencies)
      .catch((err) => {
        if (!isAbort(err)) setCurrenciesError(toApiError(err));
      });
    return () => ctrl.abort();
  }, [loadAttempt]);

  // Conversión (con debounce al escribir el monto).
  useEffect(() => {
    const value = Number(amount);
    if (amount.trim() === "" || !Number.isFinite(value) || value < 0) {
      setConversion(null);
      setConvError(null);
      return;
    }
    const ctrl = new AbortController();
    const timer = setTimeout(() => {
      setConverting(true);
      setConvError(null);
      fetchConversion(from, to, value, ctrl.signal)
        .then((data) => {
          setConversion(data);
          setConverting(false);
        })
        .catch((err) => {
          if (isAbort(err)) return;
          setConversion(null);
          setConvError(toApiError(err));
          setConverting(false);
        });
    }, 350);
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [amount, from, to, convAttempt]);

  const swap = useCallback(() => {
    setFrom(to);
    setTo(from);
  }, [from, to]);

  const codes = Object.keys(currencies).sort();
  const invalidAmount = amount.trim() !== "" && (!Number.isFinite(Number(amount)) || Number(amount) < 0);
  const fmt = (n: number, max = 2) => n.toLocaleString("es", { maximumFractionDigits: max });

  return (
    <main className="container">
      <header>
        <h1>Convertidor de divisas</h1>
        <p className="muted">Tasas de cambio del Banco Central Europeo vía Frankfurter.</p>
      </header>

      {!online && (
        <div className="offline" role="status">
          Estás sin conexión. Las conversiones se reanudarán cuando vuelvas a estar en línea.
        </div>
      )}

      {currenciesError && (
        <ErrorBanner error={currenciesError} onRetry={() => setLoadAttempt((n) => n + 1)} />
      )}

      <section className="card" aria-labelledby="conv-title">
        <h2 id="conv-title">Convertir</h2>
        <div className="form">
          <label className="field">
            <span>Monto</span>
            <input
              type="number"
              inputMode="decimal"
              min="0"
              step="any"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              aria-invalid={invalidAmount}
            />
          </label>

          <label className="field">
            <span>De</span>
            <select value={from} onChange={(e) => setFrom(e.target.value)} disabled={codes.length === 0}>
              {codes.length === 0 && <option>{from}</option>}
              {codes.map((c) => (
                <option key={c} value={c}>
                  {c} — {currencies[c]}
                </option>
              ))}
            </select>
          </label>

          <button type="button" className="swap" onClick={swap} aria-label="Intercambiar divisas" title="Intercambiar">
            ⇄
          </button>

          <label className="field">
            <span>A</span>
            <select value={to} onChange={(e) => setTo(e.target.value)} disabled={codes.length === 0}>
              {codes.length === 0 && <option>{to}</option>}
              {codes.map((c) => (
                <option key={c} value={c}>
                  {c} — {currencies[c]}
                </option>
              ))}
            </select>
          </label>
        </div>

        {invalidAmount && <p className="hint-error">Introduce un número mayor o igual a 0.</p>}
        {convError && <ErrorBanner error={convError} onRetry={() => setConvAttempt((n) => n + 1)} />}

        <div className="result" aria-live="polite">
          {converting && !conversion && <p className="muted">Convirtiendo…</p>}
          {conversion && (
            <>
              <p className="muted">
                {fmt(conversion.amount, 4)} {conversion.from} =
              </p>
              <p className="big">
                {fmt(conversion.result, 4)} <span>{conversion.to}</span>
              </p>
              <p className="muted">
                1 {conversion.from} = {fmt(conversion.rate, 6)} {conversion.to} · actualizado el {conversion.date}
              </p>
            </>
          )}
        </div>
      </section>

      <HistoryChart from={from} to={to} />

      <footer className="muted">Datos: frankfurter.dev · Solo con fines informativos.</footer>
    </main>
  );
}
