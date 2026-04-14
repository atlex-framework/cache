import { Redis } from 'ioredis'
import type { Redis as RedisClient } from 'ioredis'

import type { CacheStore } from '../contracts/CacheStore.js'
import type { LockProvider } from '../contracts/LockProvider.js'
import { CacheException } from '../exceptions/CacheException.js'

import { RedisLock } from './locks/RedisLock.js'

export interface RedisStoreConfig {
  prefix?: string
  host?: string
  port?: number
  password?: string
  db?: number
  tls?: boolean
  client?: RedisClient
  serializer?: 'json'
  retryStrategy?: (times: number) => number | null
}

function serialize(value: unknown): string {
  const normalized =
    value === undefined ? null : value instanceof Date ? value.toISOString() : value
  const json = JSON.stringify(normalized)
  if (json === undefined)
    throw new CacheException('Value is not JSON-serializable.', undefined, 'redis')
  return json
}

function deserialize<TValue>(raw: string | null): TValue | null {
  if (raw === null) return null
  return JSON.parse(raw) as TValue
}

/**
 * Redis-backed cache store (ioredis).
 */
export class RedisStore implements CacheStore, LockProvider {
  private client: RedisClient | null
  private readonly config: RedisStoreConfig
  private readonly prefix: string

  public constructor(config: RedisStoreConfig = {}) {
    this.config = config
    this.client = config.client ?? null
    this.prefix = config.prefix ?? ''
  }

  public getPrefix(): string {
    return this.prefix
  }

  public getRedisClient(): RedisClient {
    return this.getClient()
  }

  public async disconnect(): Promise<void> {
    const c = this.client
    if (!c) return
    await c.quit()
    this.client = null
  }

  public async ping(): Promise<boolean> {
    try {
      const res = await this.getClient().ping()
      return res === 'PONG'
    } catch {
      return false
    }
  }

  public async get<TValue = unknown>(key: string): Promise<TValue | null> {
    try {
      const raw = await this.getClient().get(this.withPrefix(key))
      return deserialize<TValue>(raw)
    } catch (cause) {
      throw new CacheException('RedisStore.get failed.', cause, 'redis')
    }
  }

  public async put(key: string, value: unknown, ttl?: number): Promise<boolean> {
    try {
      const k = this.withPrefix(key)
      const v = serialize(value)
      await (ttl && ttl > 0 ? this.getClient().setex(k, ttl, v) : this.getClient().set(k, v))
      return true
    } catch (cause) {
      throw new CacheException('RedisStore.put failed.', cause, 'redis')
    }
  }

  public async add(key: string, value: unknown, ttl?: number): Promise<boolean> {
    try {
      const k = this.withPrefix(key)
      const v = serialize(value)
      const ttlMs = Math.max(0, ttl ?? 0) * 1000
      const res =
        ttl && ttl > 0
          ? await this.getClient().set(k, v, 'PX', ttlMs, 'NX')
          : await this.getClient().set(k, v, 'NX')
      return res === 'OK'
    } catch (cause) {
      throw new CacheException('RedisStore.add failed.', cause, 'redis')
    }
  }

  public async putMany(values: Record<string, unknown>, ttl?: number): Promise<boolean> {
    try {
      const p = this.getClient().pipeline()
      for (const [k, v] of Object.entries(values)) {
        const key = this.withPrefix(k)
        const value = serialize(v)
        if (ttl && ttl > 0) p.setex(key, ttl, value)
        else p.set(key, value)
      }
      await p.exec()
      return true
    } catch (cause) {
      throw new CacheException('RedisStore.putMany failed.', cause, 'redis')
    }
  }

  public async many<TValue = unknown>(keys: string[]): Promise<Record<string, TValue | null>> {
    try {
      const prefixed = keys.map((k) => this.withPrefix(k))
      const values = await this.getClient().mget(...prefixed)
      const out: Record<string, TValue | null> = {}
      for (let i = 0; i < keys.length; i += 1) {
        out[keys[i]!] = deserialize<TValue>(values[i] ?? null)
      }
      return out
    } catch (cause) {
      throw new CacheException('RedisStore.many failed.', cause, 'redis')
    }
  }

  public async has(key: string): Promise<boolean> {
    try {
      const res = await this.getClient().exists(this.withPrefix(key))
      return res === 1
    } catch (cause) {
      throw new CacheException('RedisStore.has failed.', cause, 'redis')
    }
  }

  public async missing(key: string): Promise<boolean> {
    return !(await this.has(key))
  }

  public async forget(key: string): Promise<boolean> {
    try {
      const res = await this.getClient().del(this.withPrefix(key))
      return res === 1
    } catch (cause) {
      throw new CacheException('RedisStore.forget failed.', cause, 'redis')
    }
  }

  public async forgetMany(keys: string[]): Promise<void> {
    if (keys.length === 0) return
    try {
      await this.getClient().del(keys.map((k) => this.withPrefix(k)))
    } catch (cause) {
      throw new CacheException('RedisStore.forgetMany failed.', cause, 'redis')
    }
  }

  public async flush(): Promise<boolean> {
    try {
      const client = this.getClient()
      const pattern = this.prefix.length > 0 ? `${this.prefix}:*` : '*'
      let cursor = '0'
      do {
        const [next, keys] = await client.scan(cursor, 'MATCH', pattern, 'COUNT', '100')
        cursor = next
        if (keys.length > 0) {
          await client.del(keys)
        }
      } while (cursor !== '0')
      return true
    } catch (cause) {
      throw new CacheException('RedisStore.flush failed.', cause, 'redis')
    }
  }

  public async increment(key: string, value = 1): Promise<number> {
    try {
      return await this.getClient().incrby(this.withPrefix(key), value)
    } catch (cause) {
      throw new CacheException('RedisStore.increment failed.', cause, 'redis')
    }
  }

  public async decrement(key: string, value = 1): Promise<number> {
    try {
      return await this.getClient().decrby(this.withPrefix(key), value)
    } catch (cause) {
      throw new CacheException('RedisStore.decrement failed.', cause, 'redis')
    }
  }

  public lock(name: string, seconds = 10, owner?: string): RedisLock {
    return new RedisLock(this.getClient(), this.withPrefix(`lock:${name}`), seconds, owner)
  }

  private getClient(): RedisClient {
    if (this.client) return this.client
    const host = this.config.host ?? '127.0.0.1'
    const port = this.config.port ?? 6379
    this.client = new Redis({
      host,
      port,
      password: this.config.password,
      db: this.config.db,
      tls: this.config.tls ? {} : undefined,
      retryStrategy: this.config.retryStrategy,
      lazyConnect: true,
    }) as unknown as RedisClient
    return this.client
  }

  private withPrefix(key: string): string {
    return this.prefix.length > 0 ? `${this.prefix}:${key}` : key
  }
}
