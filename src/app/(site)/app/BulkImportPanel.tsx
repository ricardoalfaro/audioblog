'use client';

import { useRef, useState } from 'react';
import { Article } from '@/types';
import { getArticlesList } from '@/lib/articleStorage';
import { buildArticleFromScrape } from '@/lib/buildArticleFromScrape';
import { useAudioPlayer } from '@/contexts/AudioPlayerContext';
import { useLocale, MessageKey } from '@/contexts/LocaleContext';
import { translateApiError } from '@/lib/i18n/apiError';
import { Import, Check, Circle, Refresh, WarningTriangle, InfoCircle } from 'iconoir-react';

const MAX_BULK_URLS = 25;
const PACING_MS = 500;
const RATE_LIMIT_RETRIES = [5000, 10000]; // backoff fijo entre reintentos ante 429

type BulkItemStatus = 'pending' | 'scraping' | 'translating' | 'retrying' | 'done' | 'duplicate' | 'invalid' | 'error';

interface BulkItem {
  url: string;
  status: BulkItemStatus;
  message?: string;
  detectedLang?: string | null;
  translatedTo?: string | null;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

interface BulkImportPanelProps {
  // Persiste el artículo (pruneArticles + setArticles + localStorage + notifyLibraryChanged)
  // — vive en AppClient.tsx porque depende de su estado/closures, no se puede extraer sin
  // arrastrar setArticles a este componente.
  onArticleImported: (article: Article) => void;
}

export default function BulkImportPanel({ onArticleImported }: BulkImportPanelProps) {
  const { t, locale } = useLocale();
  const { addToQueue, selectedEdgeVoice } = useAudioPlayer();

  const [rawUrls, setRawUrls] = useState('');
  const [items, setItems] = useState<BulkItem[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [formError, setFormError] = useState('');
  const cancelRef = useRef(false);

  const updateItem = (index: number, patch: Partial<BulkItem>) => {
    setItems((prev) => prev.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  };

  const runBulkImport = async () => {
    setFormError('');
    const lines = rawUrls.split('\n').map((s) => s.trim()).filter(Boolean);
    if (lines.length === 0) {
      setFormError(t('modal.bulkEmptyError'));
      return;
    }
    if (lines.length > MAX_BULK_URLS) {
      setFormError(t('modal.bulkMaxExceeded', { max: MAX_BULK_URLS }));
      return;
    }

    // Dedupe dentro de la propia lista pegada (case-insensitive) — se procesa una sola vez.
    const seen = new Set<string>();
    const urls: string[] = [];
    for (const u of lines) {
      const key = u.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        urls.push(u);
      }
    }

    setItems(urls.map((url) => ({ url, status: 'pending' })));
    setIsRunning(true);
    cancelRef.current = false;

    for (let i = 0; i < urls.length; i++) {
      if (cancelRef.current) break;
      const url = urls[i];

      try {
        new URL(url);
      } catch {
        updateItem(i, { status: 'invalid' });
        continue;
      }

      // B25: leer la biblioteca fresca de localStorage en cada iteración, no una copia tomada
      // al arrancar el loop — importante acá porque el loop mismo va agregando artículos.
      const existing = getArticlesList().find((a) => a.url !== 'manual' && a.url.toLowerCase() === url.toLowerCase());
      if (existing) {
        updateItem(i, { status: 'duplicate' });
        continue;
      }

      updateItem(i, { status: 'scraping' });
      // Optimista, igual que el step-indicator del import de una sola URL (runScrape): no hay
      // señal real del servidor a mitad de request, pero da feedback de que algo sigue en curso.
      const translatingTimer = setTimeout(() => updateItem(i, { status: 'translating' }), 1200);

      let attempt = 0;
      let done = false;
      while (!done && !cancelRef.current) {
        try {
          const res = await fetch('/api/scrape', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url, translateTo: 'auto', preferredLang: locale }),
          });

          if (res.status === 429) {
            if (attempt >= RATE_LIMIT_RETRIES.length) {
              clearTimeout(translatingTimer);
              updateItem(i, { status: 'error', message: t('errors.rateLimit') });
              done = true;
              break;
            }
            updateItem(i, { status: 'retrying' });
            await sleep(RATE_LIMIT_RETRIES[attempt]);
            attempt++;
            continue;
          }

          clearTimeout(translatingTimer);

          if (!res.ok) {
            let message = t('errors.scrapeGeneric');
            try {
              const errData = await res.json();
              message = translateApiError(t, errData, 'errors.scrapeGeneric', { tab: t('modal.manual') });
            } catch {
              // sin cuerpo JSON legible — se conserva el mensaje genérico
            }
            updateItem(i, { status: 'error', message });
            done = true;
            break;
          }

          const scrapeData = await res.json();
          const newArticle = buildArticleFromScrape(scrapeData, { selectedEdgeVoice });
          onArticleImported(newArticle);
          addToQueue(newArticle);
          updateItem(i, {
            status: 'done',
            detectedLang: scrapeData.detectedLang ?? null,
            translatedTo: scrapeData.translatedTo ?? null,
          });
          done = true;
        } catch {
          clearTimeout(translatingTimer);
          updateItem(i, { status: 'error', message: t('errors.importGeneric') });
          done = true;
        }
      }

      if (i < urls.length - 1 && !cancelRef.current) {
        await sleep(PACING_MS);
      }
    }

    setIsRunning(false);
  };

  const handleCancel = () => {
    cancelRef.current = true;
  };

  const SUMMARY_KEYS: [BulkItemStatus, MessageKey][] = [
    ['done', 'modal.bulkSummaryImported'],
    ['duplicate', 'modal.bulkSummaryDuplicate'],
    ['invalid', 'modal.bulkSummaryInvalid'],
    ['error', 'modal.bulkSummaryError'],
  ];
  const summary = items.length > 0 && !isRunning
    ? SUMMARY_KEYS
        .map(([status, key]) => {
          const count = items.filter((it) => it.status === status).length;
          return count > 0 ? t(key, { count }) : null;
        })
        .filter(Boolean)
        .join(' · ')
    : '';

  const statusIcon = (status: BulkItemStatus) => {
    switch (status) {
      case 'done': return <Check style={{ color: 'var(--color-primary)' }} />;
      case 'duplicate': return <InfoCircle style={{ color: 'var(--text-muted)' }} />;
      case 'invalid':
      case 'error': return <WarningTriangle style={{ color: '#d93025' }} />;
      case 'scraping':
      case 'translating':
      case 'retrying': return <Refresh className="icon-spin" />;
      default: return <Circle style={{ color: 'var(--text-muted)' }} />;
    }
  };

  const statusLabel = (item: BulkItem) => {
    switch (item.status) {
      case 'pending': return t('modal.bulkStatusPending');
      case 'scraping': return t('modal.bulkStatusScraping');
      case 'translating': return t('modal.bulkStatusTranslating');
      case 'retrying': return t('modal.bulkStatusRetrying');
      case 'duplicate': return t('modal.bulkStatusDuplicate');
      case 'invalid': return t('modal.bulkStatusInvalid');
      case 'error': return item.message || t('modal.bulkStatusError');
      case 'done':
        return item.translatedTo
          ? t('modal.bulkTranslatedBadge', { from: item.detectedLang ?? '?', to: item.translatedTo })
          : t('modal.bulkStatusDone');
      default: return '';
    }
  };

  const IN_PROGRESS_STATUSES: BulkItemStatus[] = ['pending', 'scraping', 'translating', 'retrying'];
  const settledCount = items.filter((it) => !IN_PROGRESS_STATUSES.includes(it.status)).length;
  const currentIndex = Math.min(settledCount + 1, items.length);

  return (
    <div className="modal-form">
      {items.length === 0 ? (
        <>
          <div>
            <label className="form-label">{t('modal.bulkTab')}</label>
            <textarea
              className="form-control"
              value={rawUrls}
              onChange={(e) => setRawUrls(e.target.value)}
              rows={8}
              placeholder={t('modal.bulkPlaceholder')}
              autoFocus
            />
          </div>
          {formError && <p className="modal-error">{formError}</p>}
          <button type="button" className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }} onClick={runBulkImport}>
            <Import /> {t('modal.bulkImportButton')}
          </button>
        </>
      ) : (
        <>
          {isRunning && (
            <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '8px' }}>
              {t('modal.bulkProgress', { current: currentIndex, total: items.length })}
            </div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '320px', overflowY: 'auto' }}>
            {items.map((item, i) => (
              <div key={`${item.url}-${i}`} style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px' }}>
                <span style={{ flexShrink: 0, width: '18px', display: 'flex', justifyContent: 'center' }}>{statusIcon(item.status)}</span>
                <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={item.url}>
                  {item.url}
                </span>
                <span style={{ flexShrink: 0, color: 'var(--text-muted)', maxWidth: '45%', textAlign: 'right' }}>{statusLabel(item)}</span>
              </div>
            ))}
          </div>

          {isRunning ? (
            <button type="button" className="btn" style={{ width: '100%', justifyContent: 'center' }} onClick={handleCancel}>
              {t('modal.bulkCancelButton')}
            </button>
          ) : (
            <>
              {summary && <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0 }}>{summary}</p>}
              <button
                type="button"
                className="btn btn-primary"
                style={{ width: '100%', justifyContent: 'center' }}
                onClick={() => { setItems([]); setRawUrls(''); }}
              >
                {t('modal.bulkDone')}
              </button>
            </>
          )}
        </>
      )}
    </div>
  );
}
