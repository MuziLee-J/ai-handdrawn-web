'use client';

import { useEffect, useState } from 'react';

export function useLoadedImage(
  src: string,
  onLoaded?: () => void,
  onError?: () => void,
): HTMLImageElement | null {
  const [image, setImage] = useState<HTMLImageElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    const element = new window.Image();
    element.crossOrigin = 'anonymous';
    element.decoding = 'async';
    element.onload = () => {
      if (cancelled) return;
      setImage(element);
      onLoaded?.();
    };
    element.onerror = () => {
      if (cancelled) return;
      setImage(null);
      onError?.();
    };
    element.src = src;
    return () => {
      cancelled = true;
      element.onload = null;
      element.onerror = null;
    };
    // onLoaded/onError 由调用方保证稳定或可忽略重复触发。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src]);

  return image;
}
