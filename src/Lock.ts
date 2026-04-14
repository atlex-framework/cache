import crypto from 'node:crypto'

import { LockTimeoutException } from './exceptions/LockTimeoutException.js'

/**
 * Abstract base class for all lock implementations.
 */
export abstract class Lock {
  public constructor(
    protected readonly name: string,
    protected readonly seconds: number,
    protected readonly owner: string = crypto.randomUUID(),
  ) {}

  /**
   * Attempt to acquire the lock.
   */
  public abstract acquire(): Promise<boolean>

  /**
   * Release the lock.
   */
  public abstract release(): Promise<boolean>

  /**
   * Force-release regardless of owner.
   */
  public abstract forceRelease(): Promise<void>

  /**
   * Get the current owner, or null if not held.
   */
  public abstract getCurrentOwner(): Promise<string | null>

  /**
   * Acquire the lock, execute callback, then release.
   *
   * @typeParam TValue - Callback result type.
   * @param timeout - Seconds to wait for acquisition.
   * @param callback - Callback to execute while holding the lock.
   * @throws LockTimeoutException - When lock cannot be acquired within timeout.
   */
  public async block<TValue>(
    timeout: number,
    callback: () => TValue | Promise<TValue>,
  ): Promise<TValue> {
    const startedAt = Date.now()
    for (;;) {
      if (await this.acquire()) {
        try {
          return await callback()
        } finally {
          await this.release()
        }
      }
      const elapsed = (Date.now() - startedAt) / 1000
      if (elapsed >= timeout) {
        throw new LockTimeoutException(this.name, timeout)
      }
      await new Promise<void>((r) => setTimeout(r, 50))
    }
  }

  /**
   * Acquire and run callback, release after. If lock not acquired, return null.
   *
   * @typeParam TValue - Callback result type.
   */
  public async get<TValue>(callback?: () => TValue | Promise<TValue>): Promise<TValue | null> {
    if (!(await this.acquire())) return null
    try {
      if (!callback) return null
      return await callback()
    } finally {
      await this.release()
    }
  }

  /**
   * Try to acquire exactly once and run callback; throw if not acquired.
   *
   * @typeParam TValue - Callback result type.
   * @throws LockTimeoutException - When lock not acquired.
   */
  public async getOrFail<TValue>(callback: () => TValue | Promise<TValue>): Promise<TValue> {
    if (!(await this.acquire())) {
      throw new LockTimeoutException(this.name, 0)
    }
    try {
      return await callback()
    } finally {
      await this.release()
    }
  }

  public isOwnedBy(owner: string): boolean {
    return this.owner === owner
  }

  public isOwnedByCurrentProcess(): boolean {
    return true
  }

  public getOwner(): string {
    return this.owner
  }

  public getName(): string {
    return this.name
  }
}
