import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { Toaster } from "sonner";
import TransitionLoader from "@/components/ui/TransitionLoader";
import { DialogHost } from "@/components/ui/dialogs";

import { Suspense } from "react";

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ['400', '500', '600', '700', '800'],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://airpanama-david.vercel.app"),
  title: "Air Panama",
  description: "Plataforma de operaciones de la Estación Aeropuerto Internacional Enrique Malek: vuelos, registro histórico y reportes.",
  applicationName: "Air Panama",
  // Herramienta interna: que los buscadores no la muestren (ver también app/robots.ts)
  robots: { index: false, follow: false, googleBot: { index: false, follow: false } },
  // Vista previa al compartir el enlace (WhatsApp, correo…); imagen en app/opengraph-image.png
  openGraph: {
    type: "website",
    locale: "es_PA",
    siteName: "Air Panama",
    title: "Air Panama · Plataforma de Operaciones",
    description: "Estación Aeropuerto Internacional Enrique Malek. Acceso solo para personal autorizado.",
  },
};

// Se permite el zoom con dos dedos (accesibilidad). El zoom automático de iOS
// al tocar un campo se evita con inputs de 16px en móvil (ver globals.css).
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="es"
      suppressHydrationWarning
      className={`${jakarta.className} h-full antialiased`}
    >
      <head>
        <meta content="mobile_tab" name="shell-type" />
        {/* Íconos: una sola variante fija (antes se cargaban dos hojas con todas las variantes, 1,1 MB) */}
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@24,400,0,0&display=block" rel="stylesheet" />
      </head>
      <body className="bg-surface font-body-md text-body-md text-on-surface flex flex-col min-h-screen" suppressHydrationWarning>
        {children}
        <Toaster position="top-center" richColors />
        <DialogHost />
        <Suspense fallback={null}>
          <TransitionLoader />
        </Suspense>
      </body>
    </html>
  );
}
