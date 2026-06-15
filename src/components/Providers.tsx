'use client';

import React from 'react';
import { AudioPlayerProvider } from '@/contexts/AudioPlayerContext';
import GlobalPlayer from './GlobalPlayer';

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AudioPlayerProvider>
      {children}
      <GlobalPlayer />
    </AudioPlayerProvider>
  );
}
