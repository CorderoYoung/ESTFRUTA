import { useEffect, useRef } from 'react';

/**
 * Ejecuta callback tras `delayMs` sin nuevas deps; limpia al desmontar.
 */
export function useDebouncedEffect(effect, deps, delayMs) {
  const timeoutRef = useRef(null);
  const effectRef = useRef(effect);
  effectRef.current = effect;

  useEffect(() => {
    if (timeoutRef.current) {
      window.clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = window.setTimeout(() => {
      effectRef.current();
    }, delayMs);

    return () => {
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional debounce deps
  }, deps);
}
