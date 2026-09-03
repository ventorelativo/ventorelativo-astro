/**
 * The press kit's vectors.
 *
 * Served straight from `src/assets/press/` rather than copied into `public/`:
 * one file per drawing, so the download, the preview on the page and the
 * raster generated from it cannot drift apart.
 */
import type { APIRoute, GetStaticPaths } from 'astro';
import { PRESS_VARIANTS, variantSource } from '../../lib/press';

export const getStaticPaths: GetStaticPaths = () =>
  PRESS_VARIANTS.filter((v) => v.formats.includes('svg')).map((variant) => ({
    params: { slug: variant.slug },
    props: { variant },
  }));

export const GET: APIRoute = async ({ props }) => {
  const svg = await variantSource(props.variant);
  return new Response(new Uint8Array(svg), {
    headers: {
      'Content-Type': 'image/svg+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=0, must-revalidate',
    },
  });
};
