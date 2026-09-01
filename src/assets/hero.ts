/**
 * The homepage background photograph and its metadata.
 *
 * The credit (G8, `vr_creditiimmagine`) belongs to the picture, not to the
 * page: it is shown exclusively where this image is, which today means the
 * homepage only. Keeping the two in one object is what makes that true by
 * construction — a page that doesn't render `src` has no `credit` to pass on,
 * and neither can drift from the other.
 *
 * TODO(Phase 2): this becomes the `home` singleton's image field in Keystatic,
 * where the credit is a sibling field on the same image for the same reason.
 */
import homepage from './homepage.jpg';

export const HERO = {
  src: homepage,
  /** Decorative: the page's meaning does not depend on it. */
  alt: '',
  credit: {
    text: 'Elisa Cerruti - Unsplash',
    href: 'https://unsplash.com/photos/a-view-of-a-mountain-range-covered-in-fog-98wjqBqQJKc',
  },
} as const;
