import { revalidateTag, unstable_cache } from "next/cache";

// ==========================================
// CACHE TAGS — Centralized cache tag constants
// ==========================================

export const CACHE_TAGS = {
  dashboard: "dashboard",
} as const;

// ==========================================
// CACHE DEFAULTS
// ==========================================

const DEFAULT_REVALIDATE_SECONDS = 60;

/**
 * Invalidates all cache entries associated with a tag.
 * Next.js 16 requires a second argument (CacheLifeConfig).
 * Using { expire: 0 } to immediately expire entries.
 */
export function invalidateTag(tag: string) {
  revalidateTag(tag, { expire: 0 });
}

/**
 * Wraps an async function with Next.js unstable_cache.
 *
 * @param fn - The async function to cache
 * @param keyParts - Unique cache key segments
 * @param tags - Cache tags for on-demand revalidation
 * @param revalidate - Time-based revalidation in seconds (default: 60)
 */
export function withCache<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  keyParts: string[],
  tags: string[],
  revalidate: number = DEFAULT_REVALIDATE_SECONDS
): T {
  return unstable_cache(fn, keyParts, {
    revalidate,
    tags,
  }) as unknown as T;
}
