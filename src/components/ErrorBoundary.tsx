'use client';

import React from 'react';
import { LocaleContext } from '@/contexts/LocaleContext';

interface State { hasError: boolean; message: string }

export default class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  static contextType = LocaleContext;
  declare context: React.ContextType<typeof LocaleContext>;

  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error?.message ?? 'Error desconocido' };
  }

  render() {
    if (this.state.hasError) {
      const t = this.context?.t;
      return (
        <div style={{ padding: '40px 24px', textAlign: 'center', color: 'var(--text-secondary)' }}>
          <p>{t ? t('errorBoundary.message') : 'Algo salió mal al cargar la app.'}</p>
          <button
            style={{ marginTop: '16px', padding: '8px 20px', cursor: 'pointer' }}
            onClick={() => window.location.reload()}
          >
            {t ? t('errorBoundary.reload') : 'Recargar'}
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
