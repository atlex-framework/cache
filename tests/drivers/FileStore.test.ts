import { mkdir, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { describe, expect, test } from 'vitest'

import { FileStore } from '../../src/drivers/FileStore.js'

describe('FileStore', () => {
  test('put/get writes and reads file', async () => {
    const root = path.join(os.tmpdir(), `atlex-cache-${Date.now()}`)
    await mkdir(root, { recursive: true })
    const s = new FileStore({ storagePath: root, prefix: 'p' })
    await s.put('k', { a: 1 }, 60)
    expect(await s.get('k')).toEqual({ a: 1 })
    await rm(root, { recursive: true, force: true })
  })

  test('flush removes cache files', async () => {
    const root = path.join(os.tmpdir(), `atlex-cache-${Date.now()}-2`)
    await mkdir(root, { recursive: true })
    const s = new FileStore({ storagePath: root, prefix: 'p' })
    await s.put('k', 1, 60)
    await s.flush()
    expect(await s.get('k')).toBeNull()
    await rm(root, { recursive: true, force: true })
  })
})
