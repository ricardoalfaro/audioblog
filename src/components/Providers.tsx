'use client';

import React from 'react';
import { AudioPlayerProvider } from '@/contexts/AudioPlayerContext';
import { LocaleProvider } from '@/contexts/LocaleContext';
import GlobalPlayer from './GlobalPlayer';
import ErrorBoundary from './ErrorBoundary';

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <LocaleProvider>
      <ErrorBoundary>
        <AudioPlayerProvider>
          {children}
          <GlobalPlayer />
        </AudioPlayerProvider>
      </ErrorBoundary>
    </LocaleProvider>
  );
}
