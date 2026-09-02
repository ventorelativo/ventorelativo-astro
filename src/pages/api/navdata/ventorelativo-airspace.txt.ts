/**
 * The OpenAir airspace file, at the URL Drupal served it from. See the sibling
 * `.cup` route for why this is prerendered.
 */
import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';

import { buildOpenAir, type NavFeature } from '../../../lib/navdata';

export const GET: APIRoute = async () => {
  const features = await getCollection('mapFeatures');
  const body = buildOpenAir(
    features.map((entry) => entry.data as NavFeature),
    new Date(),
  );

  return new Response(body, {
    headers: { 'Content-Type': 'text/plain; charset=UTF-8' },
  });
};
