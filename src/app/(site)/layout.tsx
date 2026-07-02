import HeaderActions from "@/components/HeaderActions";
import Footer from "@/components/Footer";
import PullToRefresh from "@/components/PullToRefresh";
import { Suspense } from 'react';
import Link from 'next/link';

import Providers from '@/components/Providers';

export default function SiteLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <Providers>
      <PullToRefresh>
        <header className="main-header">
          <div className="header-content">
            <Link href="/app" className="logo">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/main_logo_audiodocs_light.svg" alt="Audiodocs: Escucha cualquier texto como si fuera un podcast" className="logo-light main-logo-img" />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/main_logo_audiodocs_dark.svg" alt="Audiodocs: Escucha cualquier texto como si fuera un podcast" className="logo-dark main-logo-img" />
            </Link>

            <Suspense fallback={
              <div className="header-right">
                <div className="avatar-dropdown">
                  <button className="avatar-btn" style={{ padding: 0, overflow: 'hidden', background: 'var(--bg-card)', border: '1px solid var(--border-color)' }} aria-label="Idioma">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src="/flags/es.svg" alt="" width={36} height={36} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
                  </button>
                </div>
                <div className="avatar-dropdown"><button className="avatar-btn" aria-label="Opciones de usuario"><i className="fa-solid fa-user"></i></button></div>
              </div>
            }>
              <HeaderActions />
            </Suspense>
          </div>
        </header>

        <div className="site-body">
          {children}
          <Footer />
        </div>
      </PullToRefresh>
    </Providers>
  );
}
