/**
 * Base error for cache-related failures.
 */
export class CacheException extends Error {
  public constructor(
    message: string,
    public override readonly cause?: unknown,
    public readonly driver?: string,
  ) {
    super(message)
    this.name = 'CacheException'
  }
}
