// Términos y condiciones de la plataforma. Si cambia el contenido, sube TERMS_VERSION:
// queda guardada junto a la aceptación de cada registro.
export const TERMS_VERSION = "2.1";
export const TERMS_DATE = "4 de noviembre de 2026";

export const TERMS: { title: string; body: string[] }[] = [
  {
    title: "1. Objeto de la plataforma",
    body: [
      "ValisVentas es una plataforma de Valis Digital para que tiendas y abarroterías lleven su caja, su inventario, las facturas de sus proveedores y sus ventas. Cada negocio solo ve su propia información.",
    ],
  },
  {
    title: "2. Cuentas y acceso",
    body: [
      "El registro queda pendiente hasta que un supervisor o el administrador lo aprueba.",
      "Tu cuenta es personal e intransferible. Eres responsable de mantener tu contraseña en reserva y de la actividad que se realice con tu cuenta.",
      "Cada cuenta tiene un rol (usuario, supervisor o administrador) que define lo que puede hacer dentro de la plataforma.",
    ],
  },
  {
    title: "3. Datos que se registran",
    body: [
      "Datos de tu cuenta: nombre, correo electrónico y cargo.",
      "Datos de conexión: dirección IP, tipo de dispositivo, sistema operativo y navegador.",
      "Actividad: páginas visitadas y acciones realizadas (ventas, facturas de proveedor, cambios de productos y precios, aprobaciones), con fecha, hora y quién las hizo.",
      "Datos de la tienda: productos, precios, costos, inventario, proveedores y ventas.",
    ],
  },
  {
    title: "4. Para qué se usan tus datos",
    body: [
      "Exclusivamente para el funcionamiento de esta plataforma: proteger las cuentas, detectar accesos no autorizados, mantener la trazabilidad de los cambios (auditoría) y darle al negocio sus propias cuentas y estadísticas.",
      "No se venden, no se usan con fines comerciales ni publicitarios y no se comparten con terceros fuera de lo indicado en el punto 5.",
    ],
  },
  {
    title: "5. Servicios que intervienen",
    body: [
      "La información se almacena y se procesa en los proveedores de infraestructura de la plataforma (Supabase para la base de datos y la autenticación, y Vercel para el alojamiento), únicamente para prestar el servicio. Las fotos de facturas se procesan con Anthropic (Claude).",
      "Si te registras con Google, Google verifica tu identidad y comparte con la plataforma tu nombre, correo y foto de perfil.",
      "Cuando se escanea un código de barras que la tienda no tiene, se consulta ese código (solo el número) en el catálogo público Open Food Facts para sugerir el nombre, la marca y la foto del producto.",
    ],
  },
  {
    title: "6. Inteligencia artificial",
    body: [
      "Cuando usas \"Tomar foto de la factura\", esa foto se envía a Claude, el servicio de inteligencia artificial de Anthropic, solo para leer los productos, cantidades y costos. La foto no se guarda en la plataforma y siempre revisas lo leído antes de guardarlo.",
      "La cámara del escáner de códigos de barras se usa solo en tu propio teléfono: esas imágenes no se guardan ni se envían.",
    ],
  },
  {
    title: "7. Cookies y almacenamiento en tu dispositivo",
    body: [
      "La plataforma usa solo lo necesario para funcionar: la cookie de tu sesión (para que no tengas que iniciar sesión en cada página) y un identificador de la sesión de acceso guardado en tu navegador.",
      "No usa cookies de publicidad, de seguimiento ni de estadísticas de terceros. Por eso no se muestra un aviso de cookies: no hay nada que aceptar o rechazar.",
    ],
  },
  {
    title: "8. Bitácora de auditoría",
    body: [
      "Las acciones quedan en una bitácora que nadie puede modificar ni borrar. Solo supervisores y el administrador pueden consultarla, para control operativo y de seguridad.",
    ],
  },
  {
    title: "9. Uso aceptable",
    body: [
      "Registrar información veraz y corregir los errores que detectes.",
      "No compartir la información del negocio con personas ajenas a él.",
      "No intentar eludir los controles de seguridad o de permisos.",
      "Corregir los errores con los medios de la plataforma (por ejemplo, anular una venta) en lugar de borrar registros.",
    ],
  },
  {
    title: "10. Conservación y derechos",
    body: [
      "Los datos se conservan mientras tu cuenta esté activa y por el tiempo necesario para la operación del negocio y la auditoría.",
      "Puedes pedir al administrador la revisión o corrección de tus datos personales.",
      "El incumplimiento de estos términos puede llevar a la suspensión de la cuenta.",
    ],
  },
  {
    title: "11. Cambios",
    body: [
      "Estos términos pueden actualizarse. Si el cambio es importante, se te avisará y podrá pedirse que los aceptes de nuevo.",
    ],
  },
];
