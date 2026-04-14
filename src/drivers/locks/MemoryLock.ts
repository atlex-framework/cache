import type { Lock } from '../../Lock.js'
import { Lock as BaseLock } from '../../Lock.js'

interface LockEntry {
  owner: string
  expiresAt: number
}

/**
 * In-process lock implementation shared by all MemoryStore instances.
 */
export class MemoryLock extends BaseLock implements Lock {
  private static readonly locks = new Map<string, LockEntry>()

  public async acquire(): Promise<boolean> {
    const now = Date.now()
    const key = this.name
    const existing = MemoryLock.locks.get(key)
    if (existing) {
      if (existing.expiresAt <= now) {
        MemoryLock.locks.delete(key)
      } else {
        return false
      }
    }
    const expiresAt = now + Math.max(0, this.seconds) * 1000
    MemoryLock.locks.set(key, { owner: this.owner, expiresAt })
    return true
  }

  public async release(): Promise<boolean> {
    const existing = MemoryLock.locks.get(this.name)
    if (!existing) return false
    if (existing.owner !== this.owner) return false
    MemoryLock.locks.delete(this.name)
    return true
  }

  public async forceRelease(): Promise<void> {
    MemoryLock.locks.delete(this.name)
  }

  public async getCurrentOwner(): Promise<string | null> {
    const existing = MemoryLock.locks.get(this.name)
    if (!existing) return null
    if (existing.expiresAt <= Date.now()) {
      MemoryLock.locks.delete(this.name)
      return null
    }
    return existing.owner
  }
}
