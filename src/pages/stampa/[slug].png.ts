/**
 * The press kit's PNGs, written at build time.
 *
 * Prerendered like every other page: these are files in `dist/`, not something
 * a function makes on request. See `src/lib/press.ts` for the list and for why
 * it is that list.
 */
import type { APIRoute, GetStaticPaths } from 'astro';
import { PRESS_ASSETS, renderAsset } from '../../lib/press';

export const getStaticPaths: GetStaticPaths = () =>
  PRESS_ASSETS.map((asset) => ({ params: { slug: asset.slug }, props: { asset } }));

export const GET: APIRoute = async ({ props }) => {
  const png = await renderAsset(props.asset);
  return new Response(new Uint8Array(png), {
    headers: {
      'Content-Type': 'image/png',
      /* Regenerated with the site; revalidate so a new logo reaches people. */
      'Cache-Control': 'public, max-age=0, must-revalidate',
    },
  });
};
