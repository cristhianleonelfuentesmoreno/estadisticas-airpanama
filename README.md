# Estadísticas Aeropuerto Enrique Malek (DAV)

Aplicación web para registrar y analizar el movimiento de vuelos y pasajeros del
Aeropuerto Enrique Malek (David, Panamá): Air Panama, Copa Airlines y vuelos privados.

**Stack:** Next.js 16 (App Router, Server Actions) · React 19 · Supabase (Auth, Postgres, Storage) · Tailwind CSS 4 · Recharts · Tesseract.js · Vercel

## Puesta en marcha

```bash
npm install
cp .env.template .env.local   # y completa los valores
npm run dev
```

Variables de entorno:

| Variable | Uso |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | URL del proyecto Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Clave pública (cliente y servidor con RLS) |
| `SUPABASE_SECRET_KEY` | Service role, **solo servidor** (`lib/supabase/admin.ts`) |

## Acceso

- Login con Supabase Auth (Google o correo/contraseña).
- Cada usuario tiene un perfil en `perfiles` con `status` (`pendiente` · `aprobado` · `rechazado`)
  y `role` (`usuario` · `administrador`). Solo los aprobados entran a `/dashboard`.
- `proxy.ts` refresca la sesión en cada petición.
- **Toda Server Action debe llamar a `requireApprovedUser()` o `requireAdmin()`** (`lib/auth.ts`)
  antes de tocar datos. El cliente admin (service role) se salta RLS: úsalo solo después de esa verificación.

## Flujo de datos

1. **Itinerario** – se carga desde imagen (OCR local con Tesseract, `app/actions/imageParser.ts`),
   CSV/Excel (`ManualFlightUploadModal`) o a mano. Se guarda en `manual_flights_log`.
2. **Tablero en vivo** – `getUpcomingFlights()` (`app/actions/flights.ts`) calcula el estado y el progreso
   de cada vuelo en hora de Panamá (`America/Panama`).
3. **Histórico** – los vuelos completados pasan a `llegadas_malek_historico` y `salidas_malek_historico`,
   que alimentan las tablas diarias y los reportes mensuales.

## Rutas

| Ruta | Contenido |
| --- | --- |
| `/login`, `/forgot-password`, `/update-password` | Autenticación |
| `/dashboard` | Vuelos del día y decisiones por clima (TAF de aviationweather.gov) |
| `/dashboard/diario` | Tablas diarias de llegadas/salidas (editables) |
| `/dashboard/mensual` | Consolidado mensual con gráficos |
| `/dashboard/admin` | Usuarios, sesiones/dispositivos, auditoría, APIs y ajustes (solo administradores) |

## Estructura

```
app/
  (auth)/          páginas de login y contraseña
  actions/         Server Actions (vuelos, admin, sesiones, clima, OCR…)
  api/auth/        callback de OAuth
  dashboard/       páginas del panel
components/        UI por área (admin, dashboard, layout, auth)
lib/               auth, clientes Supabase, auditoría
supabase/migrations/  migraciones SQL (RLS)
proxy.ts           refresco de sesión (middleware de Next 16)
```

## Notas

- El OCR de Copa usa un itinerario fijo por mes cuando existe (`COPA_HARDCODED` en `imageParser.ts`);
  para los demás meses lee la imagen.
- `npm run lint` ejecuta ESLint.
