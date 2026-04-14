import type { Redis as RedisClient } from 'ioredis'

import { CacheException } from '../../exceptions/CacheException.js'
import type { Lock } from '../../Lock.js'
import { Lock as BaseLock } from '../../Lock.js'

const RELEASE_LUA = `
if redis.call("GET", KEYS[1]) == ARGV[1] then
  return redis.call("DEL", KEYS[1])
else
  return 0
end
`

/**
 * Redis-backed lock using `SET NX PX` and owner-check release Lua script.
 */
export class RedisLock extends BaseLock implements Lock {
  public constructor(
    private readonly client: RedisClient,
    name: string,
    seconds: number,
    owner?: string,
  ) {
    super(name, seconds, owner)
  }

  public async acquire(): Promise<boolean> {
    try {
      const ttlMs = Math.max(0, this.seconds) * 1000
      const res = await this.client.set(this.name, this.owner, 'PX', ttlMs, 'NX')
      return res === 'OK'
    } catch (cause) {
      throw new CacheException('RedisLock.acquire failed.', cause, 'redis')
    }
  }

  public async release(): Promise<boolean> {
    try {
      const res = await this.client.eval(RELEASE_LUA, 1, this.name, this.owner)
      return Number(res) === 1
    } catch (cause) {
      throw new CacheException('RedisLock.release failed.', cause, 'redis')
    }
  }

  public async forceRelease(): Promise<void> {
    try {
      await this.client.del(this.name)
    } catch (cause) {
      throw new CacheException('RedisLock.forceRelease failed.', cause, 'redis')
    }
  }

  public async getCurrentOwner(): Promise<string | null> {
    try {
      const res = await this.client.get(this.name)
      return res ?? null
    } catch (cause) {
      throw new CacheException('RedisLock.getCurrentOwner failed.', cause, 'redis')
    }
  }
}
