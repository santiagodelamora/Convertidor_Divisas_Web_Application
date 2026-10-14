import type { ApiClientError } from "../api";

const TITLES: Record<ApiClientError["code"], string> = {
  OFFLINE: "Sin conexión",
  NETWORK: "No hay comunicación con el servidor",
  TIMEOUT: "La API tardó demasiado",
  RATE_LIMIT: "Límite de peticiones alcanzado",
  EMPTY_RESPONSE: "Respuesta vacía",
  NOT_FOUND: "Sin datos",
  BAD_REQUEST: "Datos no válidos",
  UPSTREAM: "Error de la API",
};

interface Props {
  error: ApiClientError;
  onRetry?: () => void;
}

export default function ErrorBanner({ error, onRetry }: Props) {
  return (
    <div className="error" role="alert">
      <div>
        <strong>{TITLES[error.code]}</strong>
        <p>
          {error.message}
          {error.code === "RATE_LIMIT" && error.retryAfter ? ` Reintenta en ${error.retryAfter} s.` : ""}
        </p>
      </div>
      {onRetry && (
        <button type="button" className="btn" onClick={onRetry}>
          Reintentar
        </button>
      )}
    </div>
  );
}
