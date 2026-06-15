import type { Metadata } from "next";
import HeaderActions from "@/components/HeaderActions";
import { Suspense } from 'react';
import Link from 'next/link';
import "./globals.css";

import Providers from '@/components/Providers';

export const metadata: Metadata = {
  title: "Audioblog | Minimalist",
  description: "Una plataforma premium para escuchar tus artículos.",
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
        <Providers>
          <header className="main-header">
            <div className="container header-content">
              <Link href="/" className="logo">
                <i className="fa-solid fa-headphones logo-icon"></i>
                <span>Audioblog</span>
              </Link>
              
              <Suspense fallback={<div className="header-right"><div className="avatar-dropdown"><button className="avatar-btn">?</button></div></div>}>
                <HeaderActions />
              </Suspense>
            </div>
          </header>

          {children}
        </Providers>
      </body>
    </html>
  );
}
