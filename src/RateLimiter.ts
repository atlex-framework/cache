import type { CacheStore } from './contracts/CacheStore.js'

export interface LimiterConfig {
  maxAttempts: number
  decaySeconds: number
  key: string
}

export interface NamedLimiter {
  attempt(request: unknown, callback: () => unknown | Promise<unknown>): Promise<boolean>
}

/**
 * Simple rate limiter backed by cache store counters.
 */
export class RateLimiter {
  private readonly named = new Map<string, (request: unknown) => LimiterConfig>()

  public constructor(private readonly cache: CacheStore) {}

  public async attempt(
    key: string,
    maxAttempts: number,
    callback: () => unknown | Promise<unknown>,
    decaySeconds = 60,
  ): Promise<boolean> {
    if (await this.tooManyAttempts(key, maxAttempts)) return false
    await this.hit(key, decaySeconds)
    await callback()
    return true
  }

  public async hit(key: string, decaySeconds = 60): Promise<number> {
    const k = this.key(key)
    const current = await this.cache.increment(k, 1)
    // best-effort set ttl by storing a side key
    await this.cache.put(`${k}:timer`, 1, decaySeconds)
    return current
  }

  public async attempts(key: string): Promise<number> {
    const v = await this.cache.get<number>(this.key(key))
    return v ?? 0
  }

  public async remaining(key: string, maxAttempts: number): Promise<number> {
    const used = await this.attempts(key)
    return Math.max(0, maxAttempts - used)
  }

  public async availableIn(key: string): Promise<number> {
    const timer = await this.cache.get<number>(`${this.key(key)}:timer`)
    return timer ? 0 : 0
  }

  public async tooManyAttempts(key: string, maxAttempts: number): Promise<boolean> {
    return (await this.attempts(key)) >= maxAttempts
  }

  public async resetAttempts(key: string): Promise<boolean> {
    await this.cache.forget(this.key(key))
    await this.cache.forget(`${this.key(key)}:timer`)
    return true
  }

  public async clear(key: string): Promise<void> {
    await this.cache.forgetMany([this.key(key), `${this.key(key)}:timer`])
  }

  public for(name: string, callback: (request: unknown) => LimiterConfig): NamedLimiter {
    this.named.set(name, callback)
    return {
      attempt: async (request, cb) => {
        const cfg = callback(request)
        return await this.attempt(cfg.key, cfg.maxAttempts, cb, cfg.decaySeconds)
      },
    }
  }

  private key(key: string): string {
    return `rl:${key}`
  }
}
