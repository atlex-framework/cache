import type { CacheStore } from './contracts/CacheStore.js'
import { type TagSet } from './TagSet.js'

/**
 * Tag-scoped cache wrapper.
 */
export class TaggedCache {
  public constructor(
    private readonly store: CacheStore,
    private readonly tags: TagSet,
  ) {}

  public async get<TValue>(key: string): Promise<TValue | null> {
    return await this.store.get<TValue>(await this.taggedKey(key))
  }

  public async many<TValue>(keys: string[]): Promise<Record<string, TValue | null>> {
    const tagged = await Promise.all(keys.map(async (k) => await this.taggedKey(k)))
    const res = await this.store.many<TValue>(tagged)
    const out: Record<string, TValue | null> = {}
    for (let i = 0; i < keys.length; i += 1) {
      out[keys[i]!] = res[tagged[i]!] ?? null
    }
    return out
  }

  public async has(key: string): Promise<boolean> {
    return await this.store.has(await this.taggedKey(key))
  }

  public async missing(key: string): Promise<boolean> {
    return await this.store.missing(await this.taggedKey(key))
  }

  public async put(key: string, value: unknown, ttl?: number): Promise<boolean> {
    return await this.store.put(await this.taggedKey(key), value, ttl)
  }

  public async add(key: string, value: unknown, ttl?: number): Promise<boolean> {
    return await this.store.add(await this.taggedKey(key), value, ttl)
  }

  public async putMany(values: Record<string, unknown>, ttl?: number): Promise<boolean> {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(values)) {
      out[await this.taggedKey(k)] = v
    }
    return await this.store.putMany(out, ttl)
  }

  public async forever(key: string, value: unknown): Promise<boolean> {
    return await this.put(key, value, 0)
  }

  public async forget(key: string): Promise<boolean> {
    return await this.store.forget(await this.taggedKey(key))
  }

  public async flush(): Promise<boolean> {
    await this.tags.reset()
    return true
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

  public async increment(key: string, value = 1): Promise<number> {
    return await this.store.increment(await this.taggedKey(key), value)
  }

  public async decrement(key: string, value = 1): Promise<number> {
    return await this.store.decrement(await this.taggedKey(key), value)
  }

  /**
   * Resolve the fully namespaced key for the current tag set.
   */
  public async taggedKey(key: string): Promise<string> {
    const ns = await this.tags.getNamespace()
    return `${ns}:${key}`
  }
}
