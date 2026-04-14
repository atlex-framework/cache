import type { Lock } from '../Lock.js'

export interface LockProvider {
  /**
   * Get a named lock instance.
   *
   * @param name - Lock name.
   * @param seconds - Lock TTL in seconds.
   * @param owner - Optional owner token.
   */
  lock(name: string, seconds?: number, owner?: string): Lock
}
