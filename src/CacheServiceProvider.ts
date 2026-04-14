import { ServiceProvider, type Application } from '@atlex/core'

import { CacheManager, type CacheConfig } from './CacheManager.js'
import { RateLimiter } from './RateLimiter.js'

function defaultCacheConfig(): CacheConfig {
  const driver = process.env.CACHE_DRIVER ?? 'memory'
  const prefix = process.env.CACHE_PREFIX ?? 'atlex_cache'
  return {
    default: driver,
    prefix,
    stores: {
      memory: { driver: 'memory' },
      file: { driver: 'file', storagePath: 'storage' },
      null: { driver: 'null' },
      redis: { driver: 'redis' },
    },
  }
}

/**
 * Registers CacheManager and RateLimiter into the container.
 */
export class CacheServiceProvider extends ServiceProvider {
  public register(app: Application): void {
    app.singleton('cache', () => new CacheManager(defaultCacheConfig(), app.container))

    app.singleton(RateLimiter.name, () => {
      const manager = app.make<CacheManager>('cache')
      return new RateLimiter(manager.store().getStore())
    })
  }

  public boot(_app: Application): void {
    // no-op: apps can stop MemoryStore sweeps by calling stopSweep on stores they own.
  }
}
