<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# ValisVentas

Sistema de tienda (inventario, escáner de código de barras, caja, estadísticas). Reemplaza a Estadísticas Air Panama y reutiliza su repo, Vercel y Supabase. El plan técnico está en `docs/VALISVENTAS-BASE.md`: léelo antes de cambiar algo.

- **Autor de los commits en este repo**: `cristhianleonelfuentesmoreno <cristhianleonelfuentesmoreno@gmail.com>`. Manda sobre el correo de `REGLAS.md`.
- No es el módulo ValisVen de ValisHub (venta de licencias): son proyectos distintos.
- **Fusionar PRs: en este repo sí se permite** (decisión de Cristhian, 2026-11-04). Manda sobre el "nunca fusionar PRs" de `REGLAS.md`. Solo con el PR en verde (comprobaciones del repo y vista previa de Vercel), con `gh pr merge --squash --match-head-commit <sha>`, y revisando después que la publicación de producción quede en `READY`. Siguen prohibidos `push --force`, `reset --hard` y `--no-verify`.
