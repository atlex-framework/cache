import type { CacheStore } from '../contracts/CacheStore.js'
import type { LockProvider } from '../contracts/LockProvider.js'

import { MemoryLock } from './locks/MemoryLock.js'

export interface MemoryStoreConfig {
  prefix?: string
  sweepInterval?: number
}

interface Entry {
  value: unknown
  expiresAt: number | null
}

/**
 * In-process cache store (Map + TTL + sweep).
 */
export class MemoryStore implements CacheStore, LockProvider {
  private readonly map = new Map<string, Entry>()
  private readonly sweepTimer: NodeJS.Timeout
  private readonly prefix: string

  public constructor(config: MemoryStoreConfig = {}) {
    this.prefix = config.prefix ?? ''
    const interval = config.sweepInterval ?? 60_000
    this.sweepTimer = setInterval(() => {
      this.sweep()
    }, interval)
    // allow process to exit
    this.sweepTimer.unref?.()
  }

  public stopSweep(): void {
    clearInterval(this.sweepTimer)
  }

  public size(): number {
    this.sweep()
    return this.map.size
  }

  public keys(): string[] {
    this.sweep()
    return Array.from(this.map.keys()).map((k) => this.stripPrefix(k))
  }

  public getPrefix(): string {
    return this.prefix
  }

  public async get<TValue = unknown>(key: string): Promise<TValue | null> {
    const k = this.withPrefix(key)
    const entry = this.map.get(k)
    if (!entry) return null
    if (this.isExpired(entry)) {
      this.map.delete(k)
      return null
    }
    return entry.value as TValue
  }

  public async put(key: string, value: unknown, ttl?: number): Promise<boolean> {
    const k = this.withPrefix(key)
    const expiresAt = ttl && ttl > 0 ? Date.now() + ttl * 1000 : null
    this.map.set(k, { value, expiresAt })
    return true
  }

  public async add(key: string, value: unknown, ttl?: number): Promise<boolean> {
    const k = this.withPrefix(key)
    const existing = this.map.get(k)
    if (existing && !this.isExpired(existing)) return false
    const expiresAt = ttl && ttl > 0 ? Date.now() + ttl * 1000 : null
    this.map.set(k, { value, expiresAt })
    return true
  }

  public async putMany(values: Record<string, unknown>, ttl?: number): Promise<boolean> {
    const expiresAt = ttl && ttl > 0 ? Date.now() + ttl * 1000 : null
    for (const [key, value] of Object.entries(values)) {
      this.map.set(this.withPrefix(key), { value, expiresAt })
    }
    return true
  }

  public async many<TValue = unknown>(keys: string[]): Promise<Record<string, TValue | null>> {
    const out: Record<string, TValue | null> = {}
    for (const key of keys) {
      out[key] = await this.get<TValue>(key)
    }
    return out
  }

  public async has(key: string): Promise<boolean> {
    return (await this.get(key)) !== null
  }

  public async missing(key: string): Promise<boolean> {
    return !(await this.has(key))
  }

  public async forget(key: string): Promise<boolean> {
    const k = this.withPrefix(key)
    const existed = this.map.has(k)
    this.map.delete(k)
    return existed
  }

  public async forgetMany(keys: string[]): Promise<void> {
    for (const k of keys) {
      this.map.delete(this.withPrefix(k))
    }
  }

  public async flush(): Promise<boolean> {
    this.map.clear()
    return true
  }

  public async increment(key: string, value = 1): Promise<number> {
    const current = (await this.get<number>(key)) ?? 0
    const next = current + value
    await this.put(key, next)
    return next
  }

  public async decrement(key: string, value = 1): Promise<number> {
    const current = (await this.get<number>(key)) ?? 0
    const next = current - value
    await this.put(key, next)
    return next
  }

  public lock(name: string, seconds = 10, owner?: string): MemoryLock {
    return new MemoryLock(this.withPrefix(`lock:${name}`), seconds, owner)
  }

  private withPrefix(key: string): string {
    return this.prefix.length > 0 ? `${this.prefix}:${key}` : key
  }

  private stripPrefix(key: string): string {
    if (this.prefix.length === 0) return key
    const p = `${this.prefix}:`
    return key.startsWith(p) ? key.slice(p.length) : key
  }

  private isExpired(entry: Entry): boolean {
    return entry.expiresAt !== null && entry.expiresAt <= Date.now()
  }

  private sweep(): void {
    const now = Date.now()
    for (const [k, v] of this.map.entries()) {
      if (v.expiresAt !== null && v.expiresAt <= now) {
        this.map.delete(k)
      }
    }
  }
}
