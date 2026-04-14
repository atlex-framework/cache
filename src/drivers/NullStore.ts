import type { CacheStore } from '../contracts/CacheStore.js'
import { CacheException } from '../exceptions/CacheException.js'
import type { Lock } from '../Lock.js'

/**
 * No-op cache store.
 */
export class NullStore implements CacheStore {
  public constructor(private readonly prefix = '') {}

  public async get<TValue = unknown>(_key: string): Promise<TValue | null> {
    return null
  }

  public async put(_key: string, _value: unknown, _ttl?: number): Promise<boolean> {
    return true
  }

  public async add(_key: string, _value: unknown, _ttl?: number): Promise<boolean> {
    return true
  }

  public async putMany(_values: Record<string, unknown>, _ttl?: number): Promise<boolean> {
    return true
  }

  public async many<TValue = unknown>(keys: string[]): Promise<Record<string, TValue | null>> {
    const out: Record<string, TValue | null> = {}
    for (const k of keys) out[k] = null
    return out
  }

  public async has(_key: string): Promise<boolean> {
    return false
  }

  public async missing(_key: string): Promise<boolean> {
    return true
  }

  public async forget(_key: string): Promise<boolean> {
    return false
  }

  public async forgetMany(_keys: string[]): Promise<void> {
    return
  }

  public async flush(): Promise<boolean> {
    return true
  }

  public async increment(_key: string, _value = 1): Promise<number> {
    return 0
  }

  public async decrement(_key: string, _value = 1): Promise<number> {
    return 0
  }

  public getPrefix(): string {
    return this.prefix
  }

  /**
   * @throws CacheException Always, because NullStore does not support locks.
   */
  public lock(_name: string, _seconds?: number, _owner?: string): Lock {
    throw new CacheException('NullStore does not support locks', undefined, 'null')
  }
}
