import type { Container } from '@atlex/core'

import type { CacheStore } from './contracts/CacheStore.js'
import { FileStore, type FileStoreConfig } from './drivers/FileStore.js'
import { MemoryStore, type MemoryStoreConfig } from './drivers/MemoryStore.js'
import { NullStore } from './drivers/NullStore.js'
import { RedisStore, type RedisStoreConfig } from './drivers/RedisStore.js'
import { DriverNotFoundException } from './exceptions/DriverNotFoundException.js'
import { Repository } from './Repository.js'

export type DriverConfig =
  | (RedisStoreConfig & { driver: 'redis' })
  | (MemoryStoreConfig & { driver: 'memory' })
  | (FileStoreConfig & { driver: 'file' })
  | { driver: 'null' }
  | { driver: string; [key: string]: unknown }

export interface CacheConfig {
  default: string
  prefix: string
  stores: Record<string, DriverConfig>
}

export type { RedisStoreConfig, MemoryStoreConfig, FileStoreConfig }

type StoreFactory = (config: unknown, container: Container) => CacheStore

/**
 * Central cache manager (store registry + top-level proxy API).
 */
export class CacheManager {
  private readonly storesCache = new Map<string, Repository>()
  private readonly extensions = new Map<string, StoreFactory>()

  public constructor(
    private config: CacheConfig,
    private readonly container: Container,
  ) {}

  public store(name?: string): Repository {
    const storeName = name ?? this.getDefaultDriver()
    const cached = this.storesCache.get(storeName)
    if (cached) return cached

    const repo = this.createRepository(storeName)
    this.storesCache.set(storeName, repo)
    return repo
  }

  public driver(name?: string): Repository {
    return this.store(name)
  }

  public extend(
    driver: string,
    factory: (config: unknown, container: Container) => CacheStore,
  ): this {
    this.extensions.set(driver, factory)
    return this
  }

  public getDefaultDriver(): string {
    return this.config.default
  }

  public setDefaultDriver(name: string): void {
    this.config = { ...this.config, default: name }
  }

  public forgetDriver(name?: string): this {
    const storeName = name ?? this.getDefaultDriver()
    this.storesCache.delete(storeName)
    return this
  }

  public purge(name?: string): this {
    return this.forgetDriver(name)
  }

  public stores(): string[] {
    return Object.keys(this.config.stores)
  }

  public hasStore(name: string): boolean {
    return name in this.config.stores
  }

  /** Proxy methods **/
  public async get<TValue>(
    key: string,
    fallback?: TValue | (() => TValue | Promise<TValue>),
  ): Promise<TValue | null> {
    return await this.store().get<TValue>(key, fallback)
  }
  public async set(key: string, value: unknown, ttl?: number): Promise<boolean> {
    return await this.store().set(key, value, ttl)
  }
  public async put(key: string, value: unknown, ttl?: number): Promise<boolean> {
    return await this.store().put(key, value, ttl)
  }
  public async add(key: string, value: unknown, ttl?: number): Promise<boolean> {
    return await this.store().add(key, value, ttl)
  }
  public async many<TValue>(keys: string[]): Promise<Record<string, TValue | null>> {
    return await this.store().many<TValue>(keys)
  }
  public async putMany(values: Record<string, unknown>, ttl?: number): Promise<boolean> {
    return await this.store().putMany(values, ttl)
  }
  public async setMany(values: Record<string, unknown>, ttl?: number): Promise<boolean> {
    return await this.store().setMany(values, ttl)
  }
  public async forever(key: string, value: unknown): Promise<boolean> {
    return await this.store().forever(key, value)
  }
  public async forget(key: string): Promise<boolean> {
    return await this.store().forget(key)
  }
  public async flush(): Promise<boolean> {
    return await this.store().flush()
  }
  public async increment(key: string, value?: number): Promise<number> {
    return await this.store().increment(key, value ?? 1)
  }
  public async decrement(key: string, value?: number): Promise<number> {
    return await this.store().decrement(key, value ?? 1)
  }
  public tags(names: string | string[]) {
    return this.store().tags(names)
  }
  public async remember<TValue>(
    key: string,
    ttl: number,
    callback: () => TValue | Promise<TValue>,
  ): Promise<TValue> {
    return await this.store().remember(key, ttl, callback)
  }

  private createRepository(storeName: string): Repository {
    const storeConfig = this.config.stores[storeName]
    if (!storeConfig) throw new DriverNotFoundException(storeName)

    const driver = storeConfig.driver
    const prefix = `${this.config.prefix}:${storeName}`

    const custom = this.extensions.get(driver)
    const store: CacheStore =
      custom?.(storeConfig, this.container) ??
      (() => {
        switch (driver) {
          case 'redis':
            return new RedisStore({ ...(storeConfig as RedisStoreConfig), prefix })
          case 'memory':
            return new MemoryStore({ ...(storeConfig as MemoryStoreConfig), prefix })
          case 'file':
            return new FileStore({ ...(storeConfig as FileStoreConfig), prefix })
          case 'null':
            return new NullStore(prefix)
          default:
            throw new DriverNotFoundException(driver)
        }
      })()

    return new Repository(store, { prefix: '' })
  }
}
