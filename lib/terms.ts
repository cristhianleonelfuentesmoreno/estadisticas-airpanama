// Términos y condiciones de la plataforma. Si cambia el contenido, sube TERMS_VERSION:
// queda guardada junto a la aceptación de cada registro.
export const TERMS_VERSION = "1.1";
export const TERMS_DATE = "24 de septiembre de 2026";

export const TERMS: { title: string; body: string[] }[] = [
  {
    title: "1. Objeto de la plataforma",
    body: [
      "Esta plataforma es una herramienta interna de AirPanama para registrar y analizar las operaciones de la Estación Aeropuerto Internacional Enrique Malek: llegadas, salidas, pasajeros, itinerarios y reportes.",
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
      "Ubicación: las coordenadas de tu dispositivo al iniciar sesión. Es obligatoria para acceder.",
      "Datos de conexión: dirección IP, tipo de dispositivo, sistema operativo y navegador.",
      "Actividad: páginas visitadas y acciones realizadas (crear, editar, aprobar, solicitar o resolver eliminaciones, importar y exportar), con fecha, hora y el valor anterior y nuevo de lo que se modifica.",
    ],
  },
  {
    title: "4. Para qué se usan tus datos",
    body: [
      "Exclusivamente para el funcionamiento de esta plataforma: proteger las cuentas, detectar accesos no autorizados, mantener la trazabilidad de los cambios (auditoría) y generar las estadísticas operativas de la estación.",
      "No se venden, no se usan con fines comerciales ni publicitarios y no se comparten con terceros fuera de lo indicado en el punto 5.",
    ],
  },
  {
    title: "5. Servicios que intervienen",
    body: [
      "La información se almacena y se procesa en los proveedores de infraestructura de la plataforma (Supabase para la base de datos y la autenticación, y Vercel para el alojamiento), únicamente para prestar el servicio.",
      "Para mostrar la ciudad aproximada desde donde se inicia sesión, las coordenadas se consultan en el servicio de mapas OpenStreetMap (Nominatim).",
      "Si te registras con Google, Google verifica tu identidad y comparte con la plataforma tu nombre, correo y foto de perfil.",
    ],
  },
  {
    title: "6. Inteligencia artificial",
    body: [
      "La plataforma no está conectada a servicios de inteligencia artificial. La lectura de imágenes de itinerarios se hace con reconocimiento de texto (OCR) dentro de la propia plataforma, sin enviar tus datos a servicios externos de inteligencia artificial.",
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
      "No compartir la información operativa fuera de la organización.",
      "No intentar eludir los controles de seguridad, de ubicación o de permisos.",
      "Solicitar las eliminaciones de registros por el medio previsto, indicando el motivo.",
    ],
  },
  {
    title: "10. Conservación y derechos",
    body: [
      "Los datos se conservan mientras tu cuenta esté activa y por el tiempo necesario para la operación y la auditoría interna.",
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
