'use client';

import React from 'react';
import { AudioPlayerProvider } from '@/contexts/AudioPlayerContext';
import GlobalPlayer from './GlobalPlayer';
import ErrorBoundary from './ErrorBoundary';

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ErrorBoundary>
      <AudioPlayerProvider>
        {children}
        <GlobalPlayer />
      </AudioPlayerProvider>
    </ErrorBoundary>
  );
}
