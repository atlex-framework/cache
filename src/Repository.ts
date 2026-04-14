import type { CacheStore } from './contracts/CacheStore.js'
import type { LockProvider } from './contracts/LockProvider.js'
import { CacheException } from './exceptions/CacheException.js'
import { type Lock } from './Lock.js'
import { TaggedCache } from './TaggedCache.js'
import { TagSet } from './TagSet.js'

export interface RepositoryConfig {
  prefix?: string
  defaultTtl?: number
}

function resolveFallback<TValue>(
  fallback: TValue | (() => TValue | Promise<TValue>),
): Promise<TValue> | TValue {
  return typeof fallback === 'function' ? (fallback as () => TValue | Promise<TValue>)() : fallback
}

/**
 * High-level cache API over a {@link CacheStore}.
 */
export class Repository {
  private readonly prefix: string
  private readonly defaultTtl: number | undefined

  public constructor(
    private readonly store: CacheStore,
    config: RepositoryConfig = {},
  ) {
    this.prefix = config.prefix ?? ''
    this.defaultTtl = config.defaultTtl
  }

  public async get<TValue>(
    key: string,
    fallback?: TValue | (() => TValue | Promise<TValue>),
  ): Promise<TValue | null> {
    const v = await this.store.get<TValue>(this.key(key))
    if (v !== null) return v
    if (fallback === undefined) return null
    return await resolveFallback(fallback)
  }

  public async value<TValue>(key: string, fallback: TValue): Promise<TValue> {
    return (await this.get<TValue>(key, fallback)) as TValue
  }

  public async has(key: string): Promise<boolean> {
    return await this.store.has(this.key(key))
  }

  public async missing(key: string): Promise<boolean> {
    return await this.store.missing(this.key(key))
  }

  public async many<TValue>(keys: string[]): Promise<Record<string, TValue | null>> {
    const mapped = keys.map((k) => this.key(k))
    const res = await this.store.many<TValue>(mapped)
    const out: Record<string, TValue | null> = {}
    for (let i = 0; i < keys.length; i += 1) {
      out[keys[i]!] = res[mapped[i]!] ?? null
    }
    return out
  }

  public async set(key: string, value: unknown, ttl?: number): Promise<boolean> {
    return await this.put(key, value, ttl)
  }

  public async put(key: string, value: unknown, ttl?: number): Promise<boolean> {
    const effectiveTtl = ttl ?? this.defaultTtl
    return await this.store.put(this.key(key), value, effectiveTtl)
  }

  public async add(key: string, value: unknown, ttl?: number): Promise<boolean> {
    const effectiveTtl = ttl ?? this.defaultTtl
    return await this.store.add(this.key(key), value, effectiveTtl)
  }

  public async putMany(values: Record<string, unknown>, ttl?: number): Promise<boolean> {
    const effectiveTtl = ttl ?? this.defaultTtl
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(values)) out[this.key(k)] = v
    return await this.store.putMany(out, effectiveTtl)
  }

  public async setMany(values: Record<string, unknown>, ttl?: number): Promise<boolean> {
    return await this.putMany(values, ttl)
  }

  public async forever(key: string, value: unknown): Promise<boolean> {
    return await this.put(key, value, 0)
  }

  public async overwrite(key: string, value: unknown, ttl?: number): Promise<boolean> {
    return await this.put(key, value, ttl)
  }

  public async forget(key: string): Promise<boolean> {
    return await this.store.forget(this.key(key))
  }

  public async delete(key: string): Promise<boolean> {
    return await this.forget(key)
  }

  public async forgetMany(keys: string[]): Promise<void> {
    await this.store.forgetMany(keys.map((k) => this.key(k)))
  }

  public async deleteMany(keys: string[]): Promise<void> {
    await this.forgetMany(keys)
  }

  public async flush(): Promise<boolean> {
    return await this.store.flush()
  }

  public async clear(): Promise<boolean> {
    return await this.flush()
  }

  public async increment(key: string, value = 1): Promise<number> {
    return await this.store.increment(this.key(key), value)
  }

  public async decrement(key: string, value = 1): Promise<number> {
    return await this.store.decrement(this.key(key), value)
  }

  public async remember<TValue>(
    key: string,
    ttl: number,
    callback: () => TValue | Promise<TValue>,
  ): Promise<TValue> {
    const existing = await this.get<TValue>(key)
    if (existing !== null) return existing
    const value = await callback()
    await this.put(key, value, ttl)
    return value
  }

  public async rememberForever<TValue>(
    key: string,
    callback: () => TValue | Promise<TValue>,
  ): Promise<TValue> {
    return await this.remember(key, 0, callback)
  }

  public async rememberWithTags<TValue>(
    tags: string[],
    key: string,
    ttl: number,
    callback: () => TValue | Promise<TValue>,
  ): Promise<TValue> {
    return await this.tags(tags).remember(key, ttl, callback)
  }

  public async flexible<TValue>(
    key: string,
    [_minTtl, maxTtl]: [number, number],
    callback: () => TValue | Promise<TValue>,
  ): Promise<TValue> {
    // Simplified: behave like remember(maxTtl) and refresh in background if missing.
    const existing = await this.get<TValue>(key)
    if (existing !== null) return existing
    const value = await callback()
    await this.put(key, value, maxTtl)
    // background refresh when within minTtl would require TTL introspection (not in CacheStore contract)
    void Promise.resolve().then(() => undefined)
    return value
  }

  public tags(names: string | string[]): TaggedCache {
    const list = Array.isArray(names) ? names : [names]
    return new TaggedCache(this.store, new TagSet(this.store, list))
  }

  public async pull<TValue>(key: string): Promise<TValue | null> {
    const value = await this.get<TValue>(key)
    await this.forget(key)
    return value
  }

  public lock(name: string, seconds = 10, owner?: string): Lock {
    const provider = this.store as unknown as LockProvider
    if (typeof (provider as unknown as Record<string, unknown>)['lock'] !== 'function') {
      throw new CacheException('Underlying store does not support locks.')
    }
    return provider.lock(this.key(name), seconds, owner)
  }

  public getStore(): CacheStore {
    return this.store
  }

  private key(key: string): string {
    return this.prefix.length > 0 ? `${this.prefix}:${key}` : key
  }
}
