/**
 * The logo as vector, for print and for anything that will be resized.
 *
 * Served from `src/assets/logo-card.svg` rather than copied into `public/`:
 * one file, so the download and the logo in the header cannot drift apart.
 */
import type { APIRoute } from 'astro';
import { logoSource } from '../../lib/press';

export const GET: APIRoute = async () => {
  const svg = await logoSource();
  return new Response(new Uint8Array(svg), {
    headers: {
      'Content-Type': 'image/svg+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=0, must-revalidate',
    },
  });
};
