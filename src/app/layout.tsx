import type { Metadata, Viewport } from "next";
import "./globals.css";
import '@fortawesome/fontawesome-free/css/all.min.css';

export const metadata: Metadata = {
  title: "Audiodocs",
  description: "Una plataforma premium para escuchar tus artículos.",
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" suppressHydrationWarning>
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
        {children}
      </body>
    </html>
  );
}
