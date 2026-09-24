import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { Toaster } from "sonner";
import TransitionLoader from "@/components/ui/TransitionLoader";

import { Suspense } from "react";

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ['400', '500', '600', '700', '800'],
});

export const metadata: Metadata = {
  title: "Air Panama",
  description: "Plataforma operativa y estadística de Air Panama",
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
        <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200" rel="stylesheet" />
        <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap" rel="stylesheet" />
      </head>
      <body className="bg-surface font-body-md text-body-md text-on-surface flex flex-col min-h-screen" suppressHydrationWarning>
        {children}
        <Toaster position="top-center" richColors />
        <Suspense fallback={null}>
          <TransitionLoader />
        </Suspense>
      </body>
    </html>
  );
}
