'use client';
import { useEffect, type RefObject } from 'react';

const MOBILE_QUERY = '(max-width: 600px)';

/**
 * U11: en el stack de cards de mobile, la card "activa" (la que está al frente del
 * scroll horizontal) debe pintarse encima de todas las demás. El orden de pintado del
 * DOM por sí solo no alcanza porque es estático, así que acá se recalcula el z-index
 * en cada scroll: la card más cercana al borde izquierdo del contenedor pasa al frente,
 * y las demás vuelven a su z-index base (orden natural, la más reciente arriba del resto).
 *
 * Además intercepta el click en fase de captura (antes que el onClick de React que abre
 * el artículo): si se toca la porción asomada de una card que no es la activa, en vez de
 * entrar al artículo esa card pasa al frente del stack — evita "entrar directo" a una card
 * que todavía no está totalmente visible.
 */
export function useStackedCarousel(containerRef: RefObject<HTMLDivElement | null>, deps: unknown[], enabled: boolean) {
  useEffect(() => {
    const container = containerRef.current;
    if (!container || !enabled) return;
    if (typeof window === 'undefined' || !window.matchMedia(MOBILE_QUERY).matches) return;

    const cards = Array.from(container.querySelectorAll<HTMLElement>('.card-vertical'));
    if (cards.length === 0) return;

    const baseZIndex = (i: number) => cards.length - i;
    cards.forEach((card, i) => { card.style.zIndex = String(baseZIndex(i)); });

    let activeCard: HTMLElement = cards[0];
    let ticking = false;

    const setActive = (card: HTMLElement) => {
      if (card === activeCard) return;
      activeCard.style.zIndex = String(baseZIndex(cards.indexOf(activeCard)));
      card.style.zIndex = String(cards.length + 10);
      activeCard = card;
    };

    const closestCard = () => {
      const containerLeft = container.getBoundingClientRect().left;
      let closest = cards[0];
      let minDist = Infinity;
      cards.forEach(card => {
        const dist = Math.abs(card.getBoundingClientRect().left - containerLeft);
        if (dist < minDist) {
          minDist = dist;
          closest = card;
        }
      });
      return closest;
    };

    const updateActive = () => {
      ticking = false;
      setActive(closestCard());
    };

    const onScroll = () => {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(updateActive);
      }
    };

    const onClickCapture = (e: MouseEvent) => {
      const card = (e.target as HTMLElement).closest<HTMLElement>('.card-vertical');
      if (!card || !cards.includes(card) || card === activeCard) return;
      e.preventDefault();
      e.stopPropagation();
      setActive(card);
      card.scrollIntoView({ behavior: 'smooth', inline: 'start', block: 'nearest' });
    };

    updateActive();
    container.addEventListener('scroll', onScroll, { passive: true });
    container.addEventListener('click', onClickCapture, true);
    return () => {
      container.removeEventListener('scroll', onScroll);
      container.removeEventListener('click', onClickCapture, true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, enabled]);
}
