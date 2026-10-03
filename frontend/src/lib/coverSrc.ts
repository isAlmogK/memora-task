/**
 * Open Library serves each cover at S/M/L. The API hands out the L URL; thumbnails
 * use M (~4× fewer bytes), and big covers show M instantly while L fades in on top.
 */
export function coverAt(url: string, size: 'M' | 'L'): string {
  return url.replace(/-[SML]\.jpg$/, `-${size}.jpg`);
}

/** True when the browser already has this image, so it can be shown without a fade. */
export function isCached(src: string): boolean {
  const img = new Image();
  img.src = src;
  return img.complete && img.naturalWidth > 0;
}
