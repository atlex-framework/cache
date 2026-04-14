import type { Container } from '@atlex/core'
import { describe, expect, test } from 'vitest'

import { CacheManager } from '../src/CacheManager.js'
import { MemoryStore } from '../src/drivers/MemoryStore.js'
import { DriverNotFoundException } from '../src/exceptions/DriverNotFoundException.js'

describe('CacheManager', () => {
  test('default store resolution and proxy get/set', async () => {
    const c = {} as unknown as Container
    const mgr = new CacheManager(
      { default: 'memory', prefix: 'p', stores: { memory: { driver: 'memory' } } },
      c,
    )
    await mgr.set('k', 1, 60)
    expect(await mgr.get('k')).toBe(1)
  })

  test('extend custom driver factory', async () => {
    const c = {} as unknown as Container
    const mgr = new CacheManager(
      { default: 'custom', prefix: 'p', stores: { custom: { driver: 'custom' } } },
      c,
    )
    mgr.extend('custom', () => new MemoryStore())
    await mgr.set('k', 2, 60)
    expect(await mgr.get('k')).toBe(2)
  })

  test('unknown driver throws DriverNotFoundException', () => {
    const c = {} as unknown as Container
    const mgr = new CacheManager({ default: 'x', prefix: 'p', stores: {} }, c)
    expect(() => mgr.store()).toThrow(DriverNotFoundException)
  })
})
