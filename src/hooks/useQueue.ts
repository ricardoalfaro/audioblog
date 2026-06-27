'use client';
import { useState, useRef, useEffect, useCallback } from 'react';
import { Article } from '@/types';

function persistQueue(q: Article[]) {
  try { localStorage.setItem('playbackQueue', JSON.stringify(q)); } catch {}
}

export function useQueue() {
  const [queue, setQueue] = useState<Article[]>([]);
  const queueRef = useRef<Article[]>([]);

  useEffect(() => { queueRef.current = queue; }, [queue]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('playbackQueue');
      if (saved) {
        const q: Article[] = JSON.parse(saved);
        setQueue(q);
        queueRef.current = q;
      }
    } catch {}
  }, []);

  const addToQueue = useCallback((article: Article) => {
    setQueue(prev => {
      if (prev.find(a => a.id === article.id)) return prev;
      const next = [...prev, article];
      queueRef.current = next;
      persistQueue(next);
      return next;
    });
  }, []);

  const removeFromQueue = useCallback((id: string) => {
    setQueue(prev => {
      const next = prev.filter(a => a.id !== id);
      queueRef.current = next;
      persistQueue(next);
      return next;
    });
  }, []);

  const clearQueue = useCallback(() => {
    setQueue([]);
    queueRef.current = [];
    try { localStorage.removeItem('playbackQueue'); } catch {}
  }, []);

  // Removes the first item from the queue and returns it (for auto-advance).
  const consumeNextInQueue = useCallback((): Article | null => {
    const q = queueRef.current;
    if (q.length === 0) return null;
    const [next, ...rest] = q;
    queueRef.current = rest;
    setQueue(rest);
    persistQueue(rest);
    return next;
  }, []);

  return { queue, queueRef, addToQueue, removeFromQueue, clearQueue, consumeNextInQueue };
}
