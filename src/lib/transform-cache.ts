import { logger } from './logger';

/**
 * Transform Cache Service
 *
 * Caches cell transformations in memory and localStorage to avoid redundant API calls
 * for duplicate values. Particularly useful for datasets with repeating species names.
 */

export interface CacheEntry {
  input: string;
  output: string;
  prompt: string;
  timestamp: number;
  source: 'worms' | 'llm' | 'cache';
  model?: string;
}

export interface CacheStats {
  totalEntries: number;
  hits: number;
  misses: number;
  hitRate: number;
  sizeBytes: number;
}

class TransformCache {
  private cache = new Map<string, CacheEntry>();
  private readonly CACHE_KEY = 'transform-cache-v1';
  private readonly MAX_AGE = 7 * 24 * 60 * 60 * 1000; // 7 days
  private readonly MAX_ENTRIES = 10000; // Prevent unbounded growth
  private hits = 0;
  private misses = 0;

  constructor() {
    this.loadFromStorage();
  }

  /**
   * Generates a unique cache key from input and prompt
   */
  private getCacheKey(input: string, prompt: string): string {
    // Normalize input and prompt for better matching
    const normalizedInput = input.trim().toLowerCase();
    const normalizedPrompt = prompt.trim().toLowerCase();

    return `${normalizedInput}::${normalizedPrompt}`;
  }

  /**
   * Retrieves a cached transformation result
   *
   * @param input - The original cell value
   * @param prompt - The transformation prompt
   * @returns Cached output or null if not found/expired
   */
  get(input: string, prompt: string): string | null {
    const key = this.getCacheKey(input, prompt);
    const entry = this.cache.get(key);

    if (!entry) {
      this.misses++;
      return null;
    }

    // Check if cache entry is expired
    const age = Date.now() - entry.timestamp;
    if (age > this.MAX_AGE) {
      this.cache.delete(key);
      this.misses++;

      logger.info('Cache entry expired and removed', {
        context: 'transform-cache',
        data: { input, ageDays: Math.floor(age / (24 * 60 * 60 * 1000)) }
      });

      return null;
    }

    this.hits++;

    logger.info('Cache hit', {
      context: 'transform-cache',
      data: {
        input,
        output: entry.output,
        source: entry.source,
        ageDays: Math.floor(age / (24 * 60 * 60 * 1000)),
        hitRate: this.getHitRate()
      }
    });

    return entry.output;
  }

  /**
   * Stores a transformation result in the cache
   *
   * @param input - The original cell value
   * @param prompt - The transformation prompt
   * @param output - The transformed result
   * @param source - Where the transformation came from ('worms', 'llm', 'cache')
   * @param model - The model used (if applicable)
   */
  set(input: string, prompt: string, output: string, source: 'worms' | 'llm' | 'cache' = 'llm', model?: string): void {
    const key = this.getCacheKey(input, prompt);

    // Enforce max entries limit using LRU strategy
    if (this.cache.size >= this.MAX_ENTRIES && !this.cache.has(key)) {
      this.evictOldest();
    }

    const entry: CacheEntry = {
      input,
      output,
      prompt,
      timestamp: Date.now(),
      source,
      model
    };

    this.cache.set(key, entry);

    // Save to localStorage periodically (every 10 entries to reduce I/O)
    if (this.cache.size % 10 === 0) {
      this.saveToStorage();
    }

    logger.info('Cache entry added', {
      context: 'transform-cache',
      data: {
        input,
        output,
        source,
        model,
        totalEntries: this.cache.size
      }
    });
  }

  /**
   * Evicts the oldest cache entry (LRU strategy)
   */
  private evictOldest(): void {
    let oldestKey: string | null = null;
    let oldestTime = Infinity;

    for (const [key, entry] of this.cache.entries()) {
      if (entry.timestamp < oldestTime) {
        oldestTime = entry.timestamp;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
      logger.info('Cache entry evicted (LRU)', {
        context: 'transform-cache',
        data: { evictedKey: oldestKey, remainingEntries: this.cache.size }
      });
    }
  }

  /**
   * Loads cache from localStorage
   */
  private loadFromStorage(): void {
    try {
      const stored = localStorage.getItem(this.CACHE_KEY);
      if (!stored) {
        logger.info('No cache found in localStorage', { context: 'transform-cache' });
        return;
      }

      const entries: CacheEntry[] = JSON.parse(stored);
      let validEntries = 0;
      let expiredEntries = 0;

      const now = Date.now();

      entries.forEach(entry => {
        const age = now - entry.timestamp;

        if (age <= this.MAX_AGE) {
          const key = this.getCacheKey(entry.input, entry.prompt);
          this.cache.set(key, entry);
          validEntries++;
        } else {
          expiredEntries++;
        }
      });

      logger.info('Cache loaded from localStorage', {
        context: 'transform-cache',
        data: {
          validEntries,
          expiredEntries,
          totalLoaded: entries.length
        }
      });
    } catch (error) {
      logger.error('Failed to load transform cache', error as Error, {
        context: 'transform-cache'
      });
    }
  }

  /**
   * Saves cache to localStorage
   */
  saveToStorage(): void {
    try {
      const entries = Array.from(this.cache.values());
      const serialized = JSON.stringify(entries);

      localStorage.setItem(this.CACHE_KEY, serialized);

      logger.info('Cache saved to localStorage', {
        context: 'transform-cache',
        data: {
          entries: entries.length,
          sizeBytes: new Blob([serialized]).size
        }
      });
    } catch (error) {
      // Handle quota exceeded error gracefully
      if (error instanceof DOMException && error.name === 'QuotaExceededError') {
        logger.warn('localStorage quota exceeded, clearing oldest entries', {
          context: 'transform-cache'
        });

        // Remove oldest half of entries and try again
        const entriesToKeep = Math.floor(this.cache.size / 2);
        const sortedEntries = Array.from(this.cache.entries())
          .sort((a, b) => b[1].timestamp - a[1].timestamp)
          .slice(0, entriesToKeep);

        this.cache.clear();
        sortedEntries.forEach(([key, entry]) => this.cache.set(key, entry));

        // Retry save
        try {
          const entries = Array.from(this.cache.values());
          localStorage.setItem(this.CACHE_KEY, JSON.stringify(entries));
        } catch (retryError) {
          logger.error('Failed to save cache even after clearing', retryError as Error, {
            context: 'transform-cache'
          });
        }
      } else {
        logger.error('Failed to save transform cache', error as Error, {
          context: 'transform-cache'
        });
      }
    }
  }

  /**
   * Clears all cache entries
   */
  clear(): void {
    this.cache.clear();
    this.hits = 0;
    this.misses = 0;

    try {
      localStorage.removeItem(this.CACHE_KEY);
      logger.info('Cache cleared', { context: 'transform-cache' });
    } catch (error) {
      logger.error('Failed to clear cache from localStorage', error as Error, {
        context: 'transform-cache'
      });
    }
  }

  /**
   * Gets cache statistics
   */
  getStats(): CacheStats {
    const totalRequests = this.hits + this.misses;
    const hitRate = totalRequests > 0 ? (this.hits / totalRequests) * 100 : 0;

    const entries = Array.from(this.cache.values());
    const serialized = JSON.stringify(entries);
    const sizeBytes = new Blob([serialized]).size;

    return {
      totalEntries: this.cache.size,
      hits: this.hits,
      misses: this.misses,
      hitRate,
      sizeBytes
    };
  }

  /**
   * Gets current hit rate percentage
   */
  getHitRate(): number {
    const totalRequests = this.hits + this.misses;
    return totalRequests > 0 ? (this.hits / totalRequests) * 100 : 0;
  }

  /**
   * Checks if a value is cached without incrementing hit/miss counters
   */
  has(input: string, prompt: string): boolean {
    const key = this.getCacheKey(input, prompt);
    const entry = this.cache.get(key);

    if (!entry) return false;

    // Check expiration
    const age = Date.now() - entry.timestamp;
    return age <= this.MAX_AGE;
  }

  /**
   * Gets the number of entries in the cache
   */
  size(): number {
    return this.cache.size;
  }

  /**
   * Removes expired entries
   */
  pruneExpired(): number {
    const now = Date.now();
    let removed = 0;

    for (const [key, entry] of this.cache.entries()) {
      const age = now - entry.timestamp;
      if (age > this.MAX_AGE) {
        this.cache.delete(key);
        removed++;
      }
    }

    if (removed > 0) {
      this.saveToStorage();

      logger.info('Expired cache entries pruned', {
        context: 'transform-cache',
        data: { removed, remaining: this.cache.size }
      });
    }

    return removed;
  }
}

// Export singleton instance
export const transformCache = new TransformCache();

// Auto-save on page unload
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    transformCache.saveToStorage();
  });

  // Prune expired entries on startup
  setTimeout(() => {
    transformCache.pruneExpired();
  }, 1000);
}
