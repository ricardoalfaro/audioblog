import type { Metadata } from "next";
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
    <html lang="es">
      <body>
        <header className="main-header">
          <div className="container header-content">
            <a href="/" className="logo">
              <div className="logo-icon">
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M3 18v-6a9 9 0 0 1 18 0v6" />
                  <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z" />
                </svg>
              </div>
              <span>
                Audio<span className="gradient-text">blog</span>
              </span>
            </a>
            <div className="header-actions">
              <a href="/" className="btn btn-secondary">
                Explorar
              </a>
            </div>
          </div>
        </header>

        {children}
      </body>
    </html>
  );
}
