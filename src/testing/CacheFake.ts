import { AssertionError } from 'node:assert'

import type { Container } from '@atlex/core'

import { MemoryStore } from '../drivers/MemoryStore.js'
import { Repository } from '../Repository.js'

interface SetCall {
  key: string
  value: unknown
  ttl?: number
}

/**
 * In-memory cache fake for tests.
 */
export class CacheFake extends Repository {
  private readonly setCalls: SetCall[] = []
  private readonly forgetCalls: string[] = []
  private flushed = false

  private readonly storeRef: MemoryStore

  public constructor() {
    const store = new MemoryStore({ prefix: 'fake' })
    super(store)
    this.storeRef = store
  }

  public static fake(app: Container): CacheFake {
    const fake = new CacheFake()
    app.instance('cache', fake as unknown)
    return fake
  }

  public override async put(key: string, value: unknown, ttl?: number): Promise<boolean> {
    this.setCalls.push({ key, value, ttl })
    return await super.put(key, value, ttl)
  }

  public override async forget(key: string): Promise<boolean> {
    this.forgetCalls.push(key)
    return await super.forget(key)
  }

  public override async flush(): Promise<boolean> {
    this.flushed = true
    return await super.flush()
  }

  public assertSet(key: string, value?: unknown): void {
    const ok = this.setCalls.some(
      (c) => c.key === key && (value === undefined ? true : c.value === value),
    )
    if (!ok)
      throw new AssertionError({
        message: `Expected cache key ['${key}'] to be set, but it was not.`,
      })
  }

  public assertSetTimes(key: string, times: number): void {
    const actual = this.setCalls.filter((c) => c.key === key).length
    if (actual !== times) {
      throw new AssertionError({
        message: `Expected cache key ['${key}'] to be set ${times} time(s), but was set ${actual} time(s).`,
      })
    }
  }

  public assertForgotten(key: string): void {
    if (!this.forgetCalls.includes(key)) {
      throw new AssertionError({
        message: `Expected cache key ['${key}'] to be forgotten, but it was not.`,
      })
    }
  }

  public assertNotForgotten(key: string): void {
    if (this.forgetCalls.includes(key)) {
      throw new AssertionError({
        message: `Expected cache key ['${key}'] not to be forgotten, but it was.`,
      })
    }
  }

  public assertFlushed(): void {
    if (!this.flushed)
      throw new AssertionError({ message: 'Expected cache to be flushed, but it was not.' })
  }

  public assertNeverFlushed(): void {
    if (this.flushed)
      throw new AssertionError({ message: 'Expected cache not to be flushed, but it was.' })
  }

  public async assertHas(key: string): Promise<void> {
    if (!(await this.has(key)))
      throw new AssertionError({
        message: `Expected cache key ['${key}'] to exist, but it does not.`,
      })
  }

  public async assertMissing(key: string): Promise<void> {
    if (!(await this.missing(key)))
      throw new AssertionError({
        message: `Expected cache key ['${key}'] to be missing, but it exists.`,
      })
  }

  public assertNotSet(key: string): void {
    if (this.setCalls.some((c) => c.key === key)) {
      throw new AssertionError({
        message: `Expected cache key ['${key}'] not to be set, but it was.`,
      })
    }
  }

  public getSetCalls(): SetCall[] {
    return [...this.setCalls]
  }

  public getForgetCalls(): string[] {
    return [...this.forgetCalls]
  }

  public hasBeenFlushed(): boolean {
    return this.flushed
  }

  public seed(key: string, value: unknown, ttl?: number): this {
    void this.storeRef.put(key, value, ttl)
    return this
  }

  public seedMany(values: Record<string, unknown>, ttl?: number): this {
    void this.storeRef.putMany(values, ttl)
    return this
  }

  public resetRecording(): void {
    this.setCalls.length = 0
    this.forgetCalls.length = 0
    this.flushed = false
  }

  public reset(): void {
    this.resetRecording()
    void this.storeRef.flush()
  }
}
