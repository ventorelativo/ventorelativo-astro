/**
 * The press kit's PNGs, written at build time.
 *
 * Prerendered like every other page: files in `dist/`, not something a
 * function makes on request. See `src/lib/press.ts` for the list.
 */
import type { APIRoute, GetStaticPaths } from 'astro';
import { PRESS_VARIANTS, renderVariant } from '../../lib/press';

export const getStaticPaths: GetStaticPaths = () =>
  PRESS_VARIANTS.filter((v) => v.formats.includes('png')).map((variant) => ({
    params: { slug: variant.slug },
    props: { variant },
  }));

export const GET: APIRoute = async ({ props }) => {
  const png = await renderVariant(props.variant);
  return new Response(new Uint8Array(png), {
    headers: {
      'Content-Type': 'image/png',
      /* Regenerated with the site; revalidate so new artwork reaches people. */
      'Cache-Control': 'public, max-age=0, must-revalidate',
    },
  });
};
