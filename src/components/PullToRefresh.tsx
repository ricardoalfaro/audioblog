'use client';

import { useEffect, useRef, useState, ReactNode } from 'react';

const THRESHOLD = 70;
const MAX_PULL = 120;
const DAMPING = 0.5;

export default function PullToRefresh({ children }: { children: ReactNode }) {
  const [pullDistance, setPullDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [settling, setSettling] = useState(false);

  const startYRef = useRef(0);
  const pullingRef = useRef(false);
  const refreshingRef = useRef(false);
  const pullDistanceRef = useRef(0);

  useEffect(() => {
    const onTouchStart = (e: TouchEvent) => {
      if (refreshingRef.current || window.scrollY > 0) return;
      startYRef.current = e.touches[0].clientY;
      pullingRef.current = true;
      // Instant 1:1 tracking desde el primer frame del nuevo gesto, sin arrastrar
      // una transición pendiente del snap-back anterior.
      setSettling(false);
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!pullingRef.current || refreshingRef.current) return;
      const delta = e.touches[0].clientY - startYRef.current;
      if (delta <= 0 || window.scrollY > 0) {
        pullDistanceRef.current = 0;
        setPullDistance(0);
        return;
      }
      e.preventDefault();
      const next = Math.min(delta * DAMPING, MAX_PULL);
      pullDistanceRef.current = next;
      setPullDistance(next);
    };

    const onTouchEnd = () => {
      if (!pullingRef.current) return;
      pullingRef.current = false;
      setSettling(true);
      if (pullDistanceRef.current >= THRESHOLD) {
        refreshingRef.current = true;
        setPullDistance(THRESHOLD);
        setRefreshing(true);
        window.location.reload();
      } else {
        setPullDistance(0);
      }
    };

    window.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchmove', onTouchMove, { passive: false });
    window.addEventListener('touchend', onTouchEnd, { passive: true });
    return () => {
      window.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
    };
  }, []);

  const translateY = refreshing ? THRESHOLD : pullDistance;
  const progress = Math.min(pullDistance / THRESHOLD, 1);

  return (
    <>
      <div className="pull-to-refresh-indicator">
        {refreshing ? (
          <i className="fa-solid fa-circle-notch fa-spin pull-to-refresh-icon" />
        ) : (
          <i
            className="fa-solid fa-arrow-rotate-right pull-to-refresh-icon"
            style={{ transform: `rotate(${progress * 180}deg)`, opacity: progress }}
          />
        )}
      </div>
      <div
        className="pull-to-refresh-content"
        style={{
          transform: translateY ? `translateY(${translateY}px)` : undefined,
          transition: settling ? 'transform 0.2s ease' : 'none',
        }}
      >
        {children}
      </div>
    </>
  );
}
