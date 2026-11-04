# ValisVentas — Base técnica para que no falle

> Qué reutilizamos de **Estadísticas Air Panama**, **ValisHub (ValisFin)**, **ValisCard** y **ATINO web/mobile** para construir **ValisVentas**: inventario de tienda, escáner de código de barras, entrada de mercancía, ventas y estadísticas.
>
> Este documento cubre **la parte técnica** (lo que hay que tener listo para que el sistema sea seguro, bonito y no falle). La idea de negocio la pone Cristhian después, en la sección 12.
>
> Escrito el 2026-11-04. Lo que está entre `[CORCHETES]` lo decide Cristhian.

---

## 0. Resumen en 6 líneas

1. **Se reutiliza todo lo que ya está montado**: el repo de GitHub, el proyecto de Vercel y el de Supabase de Air Panama. Solo se cambian los nombres y el contenido.
2. **Diseño**: el de ValisHub (día/noche, login de dos paneles, menú lateral, `Ventana`, `Btn3D`), con un color propio `[elegir: no el amarillo #ffbd00, que ya es de ValisVen en ValisHub]`.
3. **Varias tiendas en una sola base**: el modelo de ValisCard (cada tienda ve solo lo suyo, con roles dueño y cajero).
4. **Seguridad desde la primera migración**: las 26 lecciones de ValisHub (sección 7) más las de ATINO (pruebas de la base y de concurrencia).
5. **El inventario nunca se "edita a mano"**: cada entrada, venta o ajuste es un movimiento, y el stock es la suma. Así cuadra siempre y se puede auditar.
6. **Antes de escribir código quedan 3 decisiones** (sección 1: 3, 4 y 5).

---

## 1. Decisiones antes de empezar

| # | Pregunta | Por qué importa | Recomendación |
|---|----------|-----------------|---------------|
| 1 | ~~¿Air Panama sigue en uso?~~ | **Decidido (2026-11-04): no.** Se reutiliza todo en el mismo lugar: repo, Vercel y Supabase. | — |
| 2 | ~~Nombre~~ | **Decidido (2026-11-04): el proyecto se llama ValisVentas.** El módulo ValisVen de ValisHub (licencias) no se toca. | — |
| 3 | **¿ValisVentas es el "Sistema de caja e inventario" de la propuesta a las abarroterías?** (octubre 2026, $25/mes por tienda) `[sí / no]` | Define el primer cliente, las pantallas obligatorias y los precios. | Sí: el primer cliente real son las 3 abarroterías. |
| 4 | **Factura electrónica de la DGI** `[¿la necesita la tienda?]` | En la propuesta quedó sin prometer. Cambia mucho el alcance (hay que usar un PAC autorizado). | Fase 1 sin factura electrónica: solo recibo interno. Se evalúa después con un PAC. |
| 5 | **Plan de Supabase y Vercel** `[¿gratis mientras se prueba?]` | Supabase gratis **pausa el proyecto tras 1 semana sin uso** y no tiene respaldos diarios descargables. | Gratis mientras se construye; **Supabase Pro ($25) + Vercel Pro ($20)** el día que se cobre al primer cliente (ya está en el costo por cliente). |

---

## 2. Qué hay hoy en el proyecto de Air Panama

**Copias que existen** (revisado hoy):

| Dónde | Estado |
|-------|--------|
| **GitHub** `cristhianleonelfuentesmoreno/estadisticas-airpanama` | **La más nueva** (24 oct, Next 16.4.3). Es la fuente. |
| `Documents/ValisVentas` | Clon fresco de GitHub, con `.env.local` copiado. **Aquí se trabaja.** |
| `Documents/Proyecto/estadisticas-airpanama` | 1 commit atrás de GitHub, sin cambios propios. |
| OneDrive `Desarrollo/AirPanama/estadisticas-airpanama` | Vieja (23 sep). Lo único que no estaba en GitHub se rescató en `Documents/ValisVentas-rescate-onedrive/` (diseños de pantallas en `resources/`, 3 Excel de ejemplo y 4 borradores de OCR que luego se reescribieron). |

**Stack** (igual al de los otros proyectos): Next.js 16.4 (App Router, Server Actions, `proxy.ts`), React 19.2, TypeScript, Tailwind 4, Supabase (`@supabase/ssr` + `supabase-js`), Recharts, Tesseract.js (OCR), `xlsx` y `jspdf` (reportes), `sonner` (avisos), Vercel.

**Servicios conectados**:
- Supabase: proyecto `fivelvadctsggzifcmtq` (está en `.mcp.json`).
- Variables en `.env.local`: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SECRET_KEY`, `SUPABASE_JWKS_URL`, `FLIGHTAWARE_API_KEY` (sobra en ValisVentas), `GEMINI_API_KEY` (sirve para leer facturas).
- Vercel: conectado por GitHub (no hay carpeta `.vercel` en el repo).

**Lo que ya está bien hecho y se queda**:
- `proxy.ts` con `getClaims()` (lección 4 de ValisHub ya aplicada).
- `lib/auth.ts` con `requireApprovedUser`, `requireSupervisor`, `requireAdmin`.
- `lib/supabase/{client,server,admin}.ts`.
- Encabezados de seguridad en `next.config.ts`.
- Migraciones de RLS endurecido, auditoría (`audit`), solicitudes de borrado, métricas de uso.
- Exportar a Excel y PDF, gráficas, OCR de imagen (base para "leer facturas de proveedor").
- Ningún archivo del repo ni de su historial tiene claves escritas (revisado).

**Lo que hay que limpiar**:
- **~50 scripts de prueba sueltos en la raíz** (`test-*.js`, `check_*.js`, `fix_*.js`, `debug_*.txt`, `update_21_sept*.js`, `Prueba_Agosto_2026.xlsx`, carpeta `scratch/`). Se borran o se mueven a `_local/` (ya está en `.gitignore`).
- Las migraciones empiezan en `20260923_harden_rls`: **las tablas originales se crearon a mano** en el panel de Supabase y no están en el repo. ValisVentas arranca con una **migración base nueva y completa**, para que la base se pueda recrear desde cero.
- Todo lo de vuelos: `manual_flights_log`, `llegadas_/salidas_malek_historico`, flota, FlightAware, rutas.
- `next.config.ts`: `allowedDevOrigins` con IP fija y `Permissions-Policy` con `camera=()`. **Con la cámara bloqueada el escáner no funciona**: hay que poner `camera=(self)`, como en ValisCard.

---

## 3. Cómo reutilizar GitHub, Vercel y Supabase sin configurar de nuevo

Air Panama ya no se usa (decisión 1), así que:

1. **Respaldo antes de tocar nada**: exportar los datos de Supabase (tablas de vuelos a CSV) y crear una etiqueta en git: `git tag airpanama-final`. Así se puede volver.
2. **GitHub**: Settings → renombrar el repo a `valisventas`. GitHub redirige el nombre viejo solo. Después, `git remote set-url origin https://github.com/cristhianleonelfuentesmoreno/valisventas.git`.
3. **Vercel**: el proyecto sigue conectado tras el cambio de nombre. Se renombra a `valisventas` (la dirección pasa a `valisventas.vercel.app`). Las variables de entorno se quedan. Se quita `FLIGHTAWARE_API_KEY`.
4. **Supabase**: mismo proyecto. Se renombra en el panel a "ValisVentas". Las tablas de vuelos se borran **después** del respaldo, en una migración.
5. **Auth**: en Supabase → Auth → URL Configuration, cambiar el Site URL y las Redirect URLs a `valisventas.vercel.app` (más localhost y las preview de Vercel). En Google Cloud (OAuth), agregar el dominio nuevo. (Lección 9 y 25.)
6. **`package.json`**: `name: "valisventas"`; `README.md` y `AGENTS.md` nuevos.

**Autor de los commits en este repo**: `cristhianleonelfuentesmoreno <cristhianleonelfuentesmoreno@gmail.com>` (no el correo de siempre). Ejemplo: `git -c user.name=cristhianleonelfuentesmoreno -c user.email=cristhianleonelfuentesmoreno@gmail.com commit -m "..."`.

> ⚠️ **Pendiente de seguridad**: la copia de OneDrive tiene un **token de GitHub (`github_pat_…`) escrito en `.git/config`**. Hay que revocarlo en GitHub → Settings → Developer settings → Personal access tokens, y quitarlo de ese archivo.

---

## 4. Qué se toma de cada proyecto

| De dónde | Qué se toma | Archivos de referencia |
|----------|-------------|------------------------|
| **ValisHub** | Diseño completo: paleta día/noche, login de dos paneles, portal, menú lateral, cabecera móvil, `Ventana`, `Btn3D`, `ConfirmHost`, `NavigationProgress`, admin con pestañas. Las **26 lecciones**. | `ValisHub/ATINO-WEB-REFERENCIA.md` (secciones 3 a 9), `ValisHub/F2V-CONTEXTO.md` (secciones 4 a 7), código en `ValisHub/valisfin/` |
| **ValisCard** | **Varias tiendas en una base** (`comercios` + `roles_usuario` con `superadmin`, `socia`, `dueno`, `cajero`, funciones `es_dueno()` y `es_del_comercio()` para RLS). Límite de intentos por IP con hash (`lib/limite.ts`). `requireEnv()` (`lib/env.ts`). `safe-next.ts`. Escáner con cámara (`components/caja/Escaner.tsx`). Cron diario en `vercel.json`. Planes y precios (`lib/planes.ts`). `pnpm typecheck`. | `ValisCard/supabase/migrations/20261021200000_roles_y_permisos.sql`, `ValisCard/lib/` |
| **ATINO mobile** | **Pruebas de la base**: pruebas SQL de RLS (cada rol solo ve lo suyo) y **pruebas de concurrencia** (dos cajeros venden el último producto a la vez). CI que corre todo en cada PR, orden de migraciones validado, título de PR validado. | `F2V/ATINO/supabase/tests/`, `F2V/ATINO/.github/workflows/` (`ci.yml`, `migration-order.yml`) |
| **ATINO web** | Pruebas de `lib/` con `node --test` sin instalar nada (`lib/*.test.ts`). `lib/fecha.ts` (hora de Panamá). `safe-next.ts` con su prueba. | `F2V/atino-web/package.json` (script `test`), `F2V/atino-web/lib/` |
| **Air Panama** | Lo de la sección 2: sesión, auth, auditoría, OCR, Excel/PDF, gráficas, encabezados. | este repo |
| **ValisHub (módulo ValisVen, licencias)** | Idea de catálogo, clientes, ganancia por venta y aviso por WhatsApp cuando algo vence (vencimientos de productos). | `ValisHub/valisfin/app/valisven/`, `setup_valisven_db.sql` |

---

## 5. Estructura de la app

```
/login              Inicio de sesión (Google + correo de respaldo)
/auth/callback      Vuelta de Google (solo rutas internas en ?next=)
/auth/signout       Cerrar sesión (POST)
/unauthorized       Usuario desactivado o sin tienda
/                   Portal: elige tienda (si tiene varias) y módulo
/t/[tienda]/caja         Vender: escanear, cobrar, recibo
/t/[tienda]/inventario   Productos, stock, alertas de mínimo y de vencimiento
/t/[tienda]/entradas     Mercancía que llega (a mano, escaneando o foto de la factura)
/t/[tienda]/cierre       Cierre de caja del día (efectivo, Yappy, tarjeta)
/t/[tienda]/estadisticas Ventas, ganancia, más vendidos, lo que no se mueve
/t/[tienda]/ajustes      Datos de la tienda, usuarios (dueño)
/admin              Equipo Valis: tiendas, planes, usuarios, auditoría
```

- **Una sola lista** de módulos y navegación en `lib/modulos.ts` (lección 9.2 de la referencia).
- **Tokens de color** con nombre desde el día 1 (`fondo`, `panel`, `texto`, `acento`…). Nada de colores escritos a mano (lección 9.1).
- **Caja pensada para celular y tablet**: botones grandes, una mano, funciona en 390 px.

---

## 6. Modelo de datos (borrador técnico)

Todas las tablas llevan `tienda_id`, RLS y `creado_en`/`creado_por`.

| Tabla | Para qué |
|-------|----------|
| `negocios` | El cliente que paga (la señora de las 3 abarroterías). Plan y estado de pago. |
| `tiendas` | Cada local. Pertenece a un negocio. `slug`. |
| `roles_usuario` | `superadmin`, `socia` (equipo Valis), `dueno` (todas las tiendas del negocio), `cajero` (una tienda). Igual que ValisCard. |
| `productos` | Catálogo por negocio: nombre, código de barras, categoría, unidad, costo, precio, ITBMS (0 % / 7 % / 10 % / 15 %), stock mínimo, foto. |
| `codigos_barra` | Un producto puede tener varios códigos (caja y unidad). Único por negocio. |
| `proveedores` | Quién trae la mercancía. |
| `movimientos_inventario` | **El corazón**: cada entrada, venta, devolución, merma o ajuste es una fila con cantidad (+/−), costo y motivo. **Nunca se borra ni se edita**: un error se corrige con otro movimiento. |
| `stock` | Vista o tabla mantenida por la base: suma de movimientos por producto y tienda. |
| `ventas` + `ventas_lineas` | Ticket: líneas, totales, ITBMS, método de pago (efectivo, Yappy, tarjeta), cajero. Se anula con otro registro, no se borra (como `ventas_sin_borrar` de ValisCard). |
| `entradas` + `entradas_lineas` | Mercancía recibida, con proveedor, factura y foto. |
| `lotes` (fase 2) | Fecha de vencimiento por lote, para avisar antes de que se pierda. |
| `cierres_caja` | Lo que dice el sistema contra lo que contó el cajero; diferencia. |
| `audit_logs` | Quién cambió qué (ya existe). |

**Reglas que evitan que falle**:
- **Vender es una sola función en la base** (`registrar_venta`, `security definer`, `set search_path = public`): valida que el cajero sea de la tienda, bloquea las filas de stock (`for update`), descuenta y guarda el ticket **en una sola transacción**. Si dos cajeros venden el último producto a la vez, uno gana y el otro recibe un aviso claro.
- **Plata en centavos** (`integer`) o `numeric(12,2)`, nunca `float`. Los totales e ITBMS se calculan **una sola vez** en `lib/` y en la base (lección 13: un dato = un cálculo).
- **Fechas en hora de Panamá** con un solo helper `lib/fecha.ts` (lección 12: desde las 7 p. m. el servidor ya está en el día siguiente).
- **Stock negativo**: `[¿permitir vender sin stock con aviso, o bloquear?]`. Recomendado: permitir con aviso, porque el inventario de una abarrotería al inicio nunca está exacto, y dejarlo en la lista de "revisar".

---

## 7. Escáner de código de barras

Tres formas, en este orden de prioridad:

1. **Lector USB o Bluetooth** (los de $20–40): el lector "escribe" el código como un teclado y da Enter. Es lo más rápido y fiable para la caja. La app tiene un campo siempre enfocado que recibe el código. **Funciona en cualquier equipo, sin permisos.**
2. **Cámara del celular o tablet** para inventario y entradas:
   - `jsqr` (el de ValisCard) **solo lee QR, no códigos de barras de productos** (EAN-13, UPC-A, Code 128). Hay que usar otra librería: `@zxing/browser` (`[aprobar dependencia nueva]`).
   - La API nativa `BarcodeDetector` **no existe en Safari de iPhone**: no se puede depender de ella.
   - `Permissions-Policy: camera=(self)` en `next.config.ts` (hoy está bloqueada).
   - Solo funciona por HTTPS (Vercel sí; en local, `next dev --experimental-https` para probar desde el celular).
3. **Escribir el código a mano**, siempre disponible.

**Código desconocido**: abre "crear producto" con el código ya puesto. Opcional: buscar nombre y foto en **Open Food Facts** (gratis, sin clave) para llenar más rápido; el dueño confirma.

**Productos sin código** (pan, queso, granos a granel): botones rápidos en la caja y venta por peso o precio libre.

---

## 8. Leer facturas de proveedores con IA

Air Panama ya lee fotos (OCR con Tesseract y pruebas con Gemini). ValisCard usa la API de Claude. Para facturas:
- Foto de la factura → la IA devuelve líneas (producto, cantidad, costo) → **el dueño revisa y confirma** → se crea la entrada. **Nunca se guarda sin revisión.**
- Se hace en el servidor; la clave de IA solo en variables de entorno.
- Límite de usos por tienda y por día (costo).
- Fase 2, después de que la caja y el inventario funcionen.

---

## 9. Seguridad (lista de comprobación)

Todo esto va en la **primera migración y el primer PR**, no después:

- [ ] `revoke all on all tables in schema public from anon;` + `alter default privileges ... revoke all on tables from anon;` (lección 1).
- [ ] **RLS en todas las tablas**, filtrando por `tienda_id` o `negocio_id` con `es_del_comercio()` / `es_dueno()` (de ValisCard).
- [ ] Trigger que impide que alguien se suba de rol a sí mismo (lección 2).
- [ ] Toda función con `set search_path = public` y sin `execute` para `anon` si no hace falta (lección 3).
- [ ] `getClaims()` en `proxy.ts` y servidor; nunca `getSession()` (lección 4; ya está).
- [ ] **Cada Server Action y cada `/api` empieza con `requireUser()` y comprueba que el usuario es de esa tienda.** Las Server Actions son endpoints públicos (lección 5).
- [ ] `?next=` del callback solo acepta rutas internas: `safe-next.ts` (lección 6).
- [ ] Secretos solo en variables de entorno, con `requireEnv()`; `.env.example` con los nombres (lección 7).
- [ ] Encabezados de seguridad (ya están) + `camera=(self)`.
- [ ] Límite de intentos en login y formularios públicos (`lib/limite.ts` de ValisCard).
- [ ] La clave `SUPABASE_SECRET_KEY` solo en `lib/supabase/admin.ts` con `import "server-only"`.
- [ ] Auditoría de: ventas anuladas, ajustes de inventario, cambios de precio, cierres con diferencia, cambios de roles.
- [ ] **Respaldo**: Supabase Pro (respaldo diario). Además, un cron semanal que exporte las tablas importantes (`vercel.json` + `/api/cron`, protegido con `CRON_SECRET`).
- [ ] Revisar los avisos de seguridad de Supabase (Advisors) después de cada migración.
- [ ] Mantener Next.js al día (el repo acaba de subir a 16.4.3 por una vulnerabilidad crítica). Activar **Dependabot** en GitHub.
- [ ] Revocar el token de GitHub de la copia de OneDrive (sección 3).

---

## 10. Pruebas y CI (lo que evita que algo se rompa sin darse cuenta)

- `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build` antes de decir "listo" (igual que ValisCard).
- **Pruebas de `lib/`** con `node --test` (patrón de ATINO web): cálculo de totales, ITBMS, redondeo, fechas de Panamá, `safe-next`.
- **Pruebas de la base** (patrón de ATINO): un cajero de la tienda A no ve ni vende en la tienda B; un cajero no puede cambiar precios ni roles; `anon` no ve nada.
- **Prueba de concurrencia**: dos ventas del último producto al mismo tiempo → una sola pasa.
- **GitHub Actions** (`ci.yml`) en cada PR: lint, typecheck, pruebas, build. Ramas y PR, nada directo a `main`.
- **Base para probar**: **no la del runner de ATINO** (regla de la Mac). Opciones: una **rama de Supabase** (branching) o un segundo proyecto gratis "valisventas-pruebas". La de producción nunca se usa para probar.
- Revisar cada pantalla en **390 px, iPad y computadora, de día y de noche** (lección 9.8).

---

## 11. Fases de trabajo

| Fase | Qué | Hecho cuando |
|------|-----|--------------|
| 0 | Decisiones de la sección 1. Respaldo de Air Panama, etiqueta `airpanama-final`, renombrar repo, Vercel y Supabase. Revocar token. Limpiar scripts sueltos. | Repo `valisventas` en GitHub, Vercel publica, login funciona en el dominio nuevo. |
| 1 | **Base visual**: tokens día/noche, `ThemeToggle`, `Ventana`, `Btn3D`, `ConfirmHost`, `NavigationProgress`, `lib/modulos.ts`, login y portal con marca ValisVentas. | Se ve como ValisHub en amarillo, en celular y computadora. |
| 2 | **Base de datos y seguridad**: migración base (negocios, tiendas, roles, productos, movimientos, ventas), RLS, triggers, pruebas de RLS, CI. Borrar tablas de vuelos. | Pruebas de RLS y CI en verde. |
| 3 | **Inventario**: productos, códigos, escáner (lector + cámara), stock, mínimos, carga inicial desde Excel. | Una tienda real carga su catálogo. |
| 4 | **Caja**: vender escaneando, cobrar (efectivo / Yappy / tarjeta), recibo, anular, cierre de caja. Prueba de concurrencia. | Una tienda vende un día completo sin papel. |
| 5 | **Entradas de mercancía**: a mano, escaneando, y con foto de factura (IA + revisión). | El stock sube al recibir. |
| 6 | **Estadísticas**: ventas por día, ganancia, más vendidos, lo que no se mueve, comparación entre tiendas; Excel y PDF. | El dueño ve sus números del mes. |
| 7 | **Pulido**: PWA instalable, avisos de stock bajo y vencimientos (WhatsApp), admin del equipo Valis, planes, dominio propio. | Listo para cobrar. |

Trabajo con Codex: Claude escribe el encargo en `.tareas/<tema>.md`, Codex construye, Claude revisa y aplica las migraciones (nunca Codex).

---

## 12. Lo que falta de Cristhian (negocio)

Para cerrar el diseño de las fases 3 a 7:

- `[Qué vende la tienda y cuántos productos tiene más o menos]`
- `[Cuántos cajeros por tienda y si comparten equipo]`
- `[Qué equipo tiene: celular, tablet, computadora, impresora de recibos, lector de código]`
- `[¿Internet estable en la tienda?]` → si no, la caja necesita un modo sin conexión (más trabajo; decidir pronto).
- `[¿Vende fiado? ¿Lleva cuentas de clientes?]`
- `[¿Cómo cobra hoy Yappy y tarjeta, y qué quiere ver en el cierre?]`
- `[Qué estadísticas le importan más al dueño]`
- `[¿Integración con ValisCard (puntos por compra)?]` → la propuesta lo une: ValisCard Premium a $25 con este sistema.
- `[Logo y textos del login]` (hoy ValisVentas no tiene logo: "Valis" + "Ventas" en su color).

### Respuestas y hallazgos de la primera tienda (2026-11-04)

Primera tienda: Mini Super San Judas Tadeo 11. Las fotos se pasaron a `_local/primera-tienda/` (no va a git): `inventario-inicial.csv` (224 productos) y `productos-de-facturas.csv` (35, con código de barras y costo).

- **Equipo**: todo se hace con el **celular**. El escáner con cámara es obligatorio desde la fase 3, no un extra.
- **ITBMS**: es un dato de cada producto. Las facturas muestran comida exenta y jabón con 7 %.
- **Fiado**: no fían, pero queda como **opción** que cada tienda activa.
- **Pesa**: es de precio sencilla, sin conexión, en libras. Fase 1 de la caja: botón del producto, el cajero escribe el peso y el sistema calcula con el precio por libra.
- **Paquetes**: compran por caja o bolsa y venden suelto (Big Cola x12, Chao x100, jabón Class x6). Cada producto necesita "unidades por paquete" para que la entrada y el costo por unidad cuadren.
- **Reempaque**: compran a granel y venden en bolsitas (comida de perro a $1).
- **Proveedores**: Feduro, Dicarina y Coca-Cola FEMSA traen código de barras por producto en la factura electrónica. AJE usa un código propio. Supercentro Aloja da un recibo sin nombres. Los distribuidores pequeños entregan notas a mano.
- **Precios máximos de ACODECO** (Decreto 42 de 2024) pegados en la pared: el sistema puede avisar si un precio pasa el tope.
- **Gas**: tanques "propios" y "de empresa", compra a 4.49 y venta a 4.89. Falta entender cómo funciona antes de modelarlo.
