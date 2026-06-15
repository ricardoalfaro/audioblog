import type { Metadata } from "next";
import ThemeSwitcher from "@/components/ThemeSwitcher";
import { AudioPlayerProvider } from "@/contexts/AudioPlayerContext";
import BottomPlayer from "@/components/BottomPlayer";
import "./globals.css";

export const metadata: Metadata = {
  title: "Audioblog | Escucha tus blogs favoritos como audiolibros",
  description: "Una plataforma premium para importar tus artículos de blog favoritos y escucharlos con narración de voz interactiva y enfoque de lectura sin distracciones.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <head>
        {/* Font Awesome 6 for icons */}
        <link
          rel="stylesheet"
          href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css"
          crossOrigin="anonymous"
          referrerPolicy="no-referrer"
        />
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
      </head>
      <body>
        <AudioPlayerProvider>
          <header className="main-header">
            <div className="container header-content">
              <a href="/" className="logo">
                <div className="logo-icon">
                  <i className="fa-solid fa-headphones"></i>
                </div>
                <span>
                  Audio<span className="gradient-text">blog</span>
                </span>
              </a>
              <div className="header-actions">
                <ThemeSwitcher />
              </div>
            </div>
          </header>

          {children}
          <BottomPlayer />
        </AudioPlayerProvider>
      </body>
    </html>
  );
}
