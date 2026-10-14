# Convertidor de divisas con historial

Aplicación web que convierte entre divisas y muestra la evolución del tipo de cambio (7 días, 30 días, 90 días o 1 año).

- **Frontend:** React 18 + Vite + TypeScript + Recharts
- **Backend:** Express + TypeScript (actúa de proxy con caché hacia la API externa)
- **API externa:** [Frankfurter](https://frankfurter.dev) — gratuita y sin clave de API (tasas del Banco Central Europeo)

## Requisitos

- [Node.js](https://nodejs.org) 20 o superior (incluye npm)

## Instalación

```bash
git clone <URL-DE-TU-REPOSITORIO>
cd <carpeta-del-repositorio>
npm install
```

El proyecto usa *npm workspaces*: un único `npm install` en la raíz instala las dependencias de `server/` y `client/`.

## Ejecutar en desarrollo

```bash
npm run dev
```

Levanta a la vez:

| Servicio | URL |
| --- | --- |
| Cliente (Vite) | http://localhost:5173 |
| API (Express) | http://localhost:3001 |

Abre http://localhost:5173. Vite redirige las peticiones `/api` al servidor Express.

## Ejecutar en producción

```bash
npm run build
npm start
```

Express sirve el cliente compilado y la API en http://localhost:3001.

## Variables de entorno (opcionales)

| Variable | Por defecto | Descripción |
| --- | --- | --- |
| `PORT` | `3001` | Puerto del servidor Express |
| `FRANKFURTER_URL` | `https://api.frankfurter.dev/v1` | URL base de la API externa |

## Endpoints del servidor

| Método | Ruta | Descripción |
| --- | --- | --- |
| GET | `/api/currencies` | Lista de divisas disponibles |
| GET | `/api/convert?from=USD&to=EUR&amount=100` | Conversión con la tasa más reciente |
| GET | `/api/history?from=USD&to=EUR&days=30` | Historial de la tasa (`days`: 7, 30, 90 o 365) |
| GET | `/api/health` | Comprobación de estado |

## Manejo de errores

| Situación | Cómo se maneja |
| --- | --- |
| Sin conexión del usuario | Se detecta con `navigator.onLine` y los eventos `online`/`offline`; se muestra un aviso y un botón **Reintentar** |
| Servidor o API externa inaccesible | El servidor responde `503` (`NETWORK`) o `504` (`TIMEOUT`, límite de 8 s); el cliente muestra el mensaje |
| Respuesta vacía o inválida | El servidor responde `502` (`EMPTY_RESPONSE`); el cliente también valida que el cuerpo no esté vacío |
| Límite de peticiones | Se traslada el `429` de la API externa (con `Retry-After` si lo envía) y el servidor aplica su propio límite de 60 peticiones/minuto por IP |
| Parámetros inválidos | `400` con un mensaje descriptivo |

Además, el servidor guarda en caché las respuestas (1 min las conversiones, 10 min el historial, 24 h la lista de divisas) para reducir las llamadas a la API externa.

## Estructura

```
.
├── client/            # React + Vite
│   └── src/
│       ├── api.ts             # Peticiones y errores tipados
│       ├── App.tsx            # Convertidor
│       └── components/        # Gráfico de historial y banner de errores
├── server/            # Express
│   └── src/
│       ├── app.ts             # Rutas y manejo de errores
│       ├── frankfurter.ts     # Cliente de la API externa (timeout, caché)
│       └── errors.ts
└── package.json       # Workspaces y scripts
```

## Scripts

| Comando | Acción |
| --- | --- |
| `npm run dev` | Cliente y servidor en modo desarrollo |
| `npm run build` | Compila servidor y cliente |
| `npm start` | Inicia el servidor compilado |
| `npm run typecheck` | Verifica los tipos de TypeScript |

## Subir a GitHub

```bash
git init
git add .
git commit -m "Convertidor de divisas con historial"
git branch -M main
git remote add origin https://github.com/<usuario>/<repositorio>.git
git push -u origin main
```
