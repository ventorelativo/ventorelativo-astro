/**
 * The SeeYou waypoint file, at the URL Drupal served it from.
 *
 * Prerendered like every other page: this is a static file in `dist/`, not a
 * function. Pilots download it before flying, often on a phone at a takeoff
 * with one bar of signal, so it must come off the CDN.
 */
import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';

import { buildCup, type NavFeature } from '../../../lib/navdata';

export const GET: APIRoute = async () => {
  const features = await getCollection('mapFeatures');
  const body = buildCup(features.map((entry) => entry.data as NavFeature));

  return new Response(body, {
    headers: { 'Content-Type': 'text/plain; charset=UTF-8' },
  });
};
