import HeaderActions from "@/components/HeaderActions";
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
      <header className="main-header">
        <div className="header-content">
          <Link href="/app" className="logo">
            <img src="/main_logo_audiodocs_light.png" alt="Audiodocs: Escucha cualquier texto como si fuera un podcast" className="logo-light" style={{ height: '32px', width: 'auto' }} />
            <img src="/main_logo_audiodocs_dark.png" alt="Audiodocs: Escucha cualquier texto como si fuera un podcast" className="logo-dark" style={{ height: '32px', width: 'auto' }} />
          </Link>

          <Suspense fallback={<div className="header-right"><div className="avatar-dropdown"><button className="avatar-btn">?</button></div></div>}>
            <HeaderActions />
          </Suspense>
        </div>
      </header>

      {children}
    </Providers>
  );
}
