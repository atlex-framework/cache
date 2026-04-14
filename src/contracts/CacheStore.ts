export interface CacheStore {
  /**
   * Get a value by key. Returns null if missing or expired.
   *
   * @typeParam TValue - Expected value type.
   * @param key - Cache key.
   */
  get<TValue = unknown>(key: string): Promise<TValue | null>

  /**
   * Store a value. ttl = seconds; 0 or undefined = forever.
   *
   * @param key - Cache key.
   * @param value - Value to store (JSON-serializable).
   * @param ttl - Time to live in seconds.
   */
  put(key: string, value: unknown, ttl?: number): Promise<boolean>

  /**
   * Store a value only if the key does not already exist.
   *
   * @param key - Cache key.
   * @param value - Value to store.
   * @param ttl - Time to live in seconds.
   */
  add(key: string, value: unknown, ttl?: number): Promise<boolean>

  /**
   * Store multiple values. ttl applies to all.
   *
   * @param values - Values keyed by cache key.
   * @param ttl - Time to live in seconds.
   */
  putMany(values: Record<string, unknown>, ttl?: number): Promise<boolean>

  /**
   * Get multiple values. Missing keys return null.
   *
   * @typeParam TValue - Expected value type.
   * @param keys - Cache keys.
   */
  many<TValue = unknown>(keys: string[]): Promise<Record<string, TValue | null>>

  /**
   * Check existence without updating TTL.
   *
   * @param key - Cache key.
   */
  has(key: string): Promise<boolean>

  /**
   * Check absence.
   *
   * @param key - Cache key.
   */
  missing(key: string): Promise<boolean>

  /**
   * Delete a key. Returns true if it existed.
   *
   * @param key - Cache key.
   */
  forget(key: string): Promise<boolean>

  /**
   * Delete multiple keys.
   *
   * @param keys - Cache keys.
   */
  forgetMany(keys: string[]): Promise<void>

  /**
   * Clear the entire store (all keys with this store's prefix).
   */
  flush(): Promise<boolean>

  /**
   * Increment a numeric value by the given amount. Returns new value.
   *
   * @param key - Cache key.
   * @param value - Increment amount (default 1).
   */
  increment(key: string, value?: number): Promise<number>

  /**
   * Decrement a numeric value by the given amount. Returns new value.
   *
   * @param key - Cache key.
   * @param value - Decrement amount (default 1).
   */
  decrement(key: string, value?: number): Promise<number>

  /**
   * Returns the key prefix for this store.
   */
  getPrefix(): string
}
