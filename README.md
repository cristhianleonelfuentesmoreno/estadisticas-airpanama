# ValisVentas

Sistema para tiendas y abarroterías: inventario, escáner de código de barras desde el celular,
caja, entrada de mercancía y estadísticas. Cada negocio ve solo lo suyo.

> **En transición.** El repo, el proyecto de Vercel y el de Supabase eran de *Estadísticas Air Panama*.
> El código de la app todavía es el de Air Panama y se va reemplazando por fases.
> La última versión de Air Panama quedó en la etiqueta `airpanama-final`.

El plan técnico (decisiones, modelo de datos, seguridad y fases) está en
[`docs/VALISVENTAS-BASE.md`](docs/VALISVENTAS-BASE.md). Léelo antes de cambiar algo.

**Stack:** Next.js 16 (App Router, Server Actions) · React 19 · Supabase (Auth, Postgres) · Tailwind CSS 4 · Vercel

## Puesta en marcha

```bash
npm install
cp .env.example .env.local   # y completa los valores
npm run dev
```

| Variable | Uso |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | URL del proyecto Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Clave pública (cliente y servidor con RLS) |
| `SUPABASE_SECRET_KEY` | Service role, **solo servidor** (`lib/supabase/admin.ts`) |

## Reglas

- **Toda Server Action debe llamar a `requireApprovedUser()` o `requireAdmin()`** (`lib/auth.ts`)
  antes de tocar datos. El cliente admin (service role) se salta RLS: úsalo solo después de esa verificación.
- `npm run lint` ejecuta ESLint.
