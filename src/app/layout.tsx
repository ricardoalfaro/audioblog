import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import { IconoirProvider } from "iconoir-react";
import "./globals.css";

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
});

// D2: sin NEXT_PUBLIC_APP_URL en prod, metadataBase cae en silencio a localhost:3000 y rompe
// las URLs absolutas de OG/Twitter (ver .env.example) — se avisa una vez al arrancar el server.
if (process.env.NODE_ENV === 'production' && !process.env.NEXT_PUBLIC_APP_URL) {
  console.warn('[config] NEXT_PUBLIC_APP_URL no está definida — metadataBase cae a localhost:3000, rompiendo los previews de OG/Twitter en producción. Ver .env.example.');
}

export const metadata: Metadata = {
  title: "Audiodocs",
  description: "Escucha tus artículos favoritos como podcasts",
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'),
  openGraph: {
    title: "Audiodocs",
    description: "Escucha tus artículos favoritos como podcasts",
    type: "website",
    locale: "es_ES",
    siteName: "Audiodocs",
    images: [{ url: "/apple-touch-icon.png", width: 180, height: 180 }],
  },
  twitter: {
    card: "summary",
    title: "Audiodocs",
    description: "Escucha tus artículos favoritos como podcasts",
    images: ["/apple-touch-icon.png"],
  },
  manifest: "/site.webmanifest",
  icons: {
    icon: [
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon.ico" },
    ],
    apple: "/apple-touch-icon.png",
  },
  appleWebApp: {
    capable: true,
    title: "Audiodocs",
    statusBarStyle: "black-translucent",
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  // U20: fijo en negro dejaba la barra de estado oscura también en modo claro. Dual, alineado
  // a --bg-header (globals.css) — sigue el prefers-color-scheme del sistema, igual que el
  // fallback del theme picker cuando no hay override explícito guardado en localStorage.
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#FFFFFF" },
    { media: "(prefers-color-scheme: dark)", color: "#111111" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className={plusJakartaSans.variable} suppressHydrationWarning>
      <head>
        {/* Inline script to prevent theme flashing on page load */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                const savedTheme = localStorage.getItem('theme');
                if (savedTheme === 'dark' || (!savedTheme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
                  document.documentElement.setAttribute('data-theme', 'dark');
                } else if (savedTheme === 'light') {
                  document.documentElement.setAttribute('data-theme', 'light');
                } else {
                  document.documentElement.removeAttribute('data-theme');
                }
              } catch (_) {}
            `,
          }}
        />
        {/* Inline script to decide before paint whether the splash should be skipped (desktop + already onboarded) */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                const isMobile = window.matchMedia('(max-width: 900px)').matches;
                const isPWA = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
                const onboarded = localStorage.getItem('audiodocs_onboarded');
                if (!isMobile && !isPWA && onboarded) {
                  document.documentElement.setAttribute('data-skip-splash', 'true');
                }
              } catch (_) {}
            `,
          }}
        />
      </head>
      <body>
        <IconoirProvider iconProps={{ width: '1em', height: '1em', strokeWidth: 2 }}>
          {children}
        </IconoirProvider>
      </body>
    </html>
  );
}
