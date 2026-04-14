import crypto from 'node:crypto'
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'

import type { CacheStore } from '../contracts/CacheStore.js'
import type { LockProvider } from '../contracts/LockProvider.js'
import { CacheException } from '../exceptions/CacheException.js'

import { FileLock } from './locks/FileLock.js'

export interface FileStoreConfig {
  prefix?: string
  storagePath?: string
  dirMode?: number
}

interface FilePayload {
  expiresAt: number | null
  value: string
}

function assertJsonSerializable(value: unknown): void {
  const t = typeof value
  if (t === 'function' || t === 'symbol') {
    throw new CacheException('Value is not JSON-serializable.')
  }
}

function encode(value: unknown): string {
  assertJsonSerializable(value)
  const normalized =
    value === undefined ? null : value instanceof Date ? value.toISOString() : value
  const json = JSON.stringify(normalized)
  if (json === undefined) throw new CacheException('Value is not JSON-serializable.')
  return Buffer.from(json, 'utf8').toString('base64')
}

function decode<TValue>(b64: string): TValue {
  const json = Buffer.from(b64, 'base64').toString('utf8')
  return JSON.parse(json) as TValue
}

function sha256Hex(input: string): string {
  return crypto.createHash('sha256').update(input).digest('hex')
}

/**
 * File-based cache store (one JSON file per key).
 */
export class FileStore implements CacheStore, LockProvider {
  private readonly prefix: string
  private readonly storageRoot: string
  private readonly dirMode: number

  public constructor(config: FileStoreConfig = {}) {
    this.prefix = config.prefix ?? ''
    this.storageRoot = path.resolve(config.storagePath ?? path.join(process.cwd(), 'storage'))
    this.dirMode = config.dirMode ?? 0o755
  }

  public getPrefix(): string {
    return this.prefix
  }

  public async get<TValue = unknown>(key: string): Promise<TValue | null> {
    const file = await this.filePath(key)
    try {
      const body = await readFile(file, 'utf8')
      const parsed = JSON.parse(body) as FilePayload
      if (parsed.expiresAt !== null && parsed.expiresAt <= Date.now()) {
        await this.safeUnlink(file)
        return null
      }
      return decode<TValue>(parsed.value)
    } catch (cause) {
      if ((cause as NodeJS.ErrnoException).code === 'ENOENT') return null
      throw new CacheException('FileStore.get failed.', cause, 'file')
    }
  }

  public async put(key: string, value: unknown, ttl?: number): Promise<boolean> {
    const file = await this.filePath(key)
    const expiresAt = ttl && ttl > 0 ? Date.now() + ttl * 1000 : null
    const payload: FilePayload = { expiresAt, value: encode(value) }
    await this.atomicWrite(file, JSON.stringify(payload))
    return true
  }

  public async add(key: string, value: unknown, ttl?: number): Promise<boolean> {
    if (await this.has(key)) return false
    return await this.put(key, value, ttl)
  }

  public async putMany(values: Record<string, unknown>, ttl?: number): Promise<boolean> {
    await Promise.all(Object.entries(values).map(async ([k, v]) => await this.put(k, v, ttl)))
    return true
  }

  public async many<TValue = unknown>(keys: string[]): Promise<Record<string, TValue | null>> {
    const out: Record<string, TValue | null> = {}
    for (const k of keys) out[k] = await this.get<TValue>(k)
    return out
  }

  public async has(key: string): Promise<boolean> {
    return (await this.get(key)) !== null
  }

  public async missing(key: string): Promise<boolean> {
    return !(await this.has(key))
  }

  public async forget(key: string): Promise<boolean> {
    const file = await this.filePath(key)
    try {
      await rm(file)
      return true
    } catch (cause) {
      if ((cause as NodeJS.ErrnoException).code === 'ENOENT') return false
      throw new CacheException('FileStore.forget failed.', cause, 'file')
    }
  }

  public async forgetMany(keys: string[]): Promise<void> {
    await Promise.all(keys.map(async (k) => void (await this.forget(k))))
  }

  public async flush(): Promise<boolean> {
    const dir = this.cacheDir()
    await rm(dir, { recursive: true, force: true })
    return true
  }

  /**
   * Not atomic across processes.
   */
  public async increment(key: string, value = 1): Promise<number> {
    for (let i = 0; i < 3; i += 1) {
      const current = (await this.get<number>(key)) ?? 0
      const next = current + value
      await this.put(key, next)
      return next
    }
    throw new CacheException('FileStore.increment failed after retries.', undefined, 'file')
  }

  /**
   * Not atomic across processes.
   */
  public async decrement(key: string, value = 1): Promise<number> {
    return await this.increment(key, -value)
  }

  public lock(name: string, seconds = 10, owner?: string): FileLock {
    return new FileLock(this.lockFilePath(name), seconds, owner)
  }

  private cacheDir(): string {
    return path.join(this.storageRoot, 'cache')
  }

  private lockDir(): string {
    return path.join(this.storageRoot, 'cache', 'locks')
  }

  private async ensureDir(dir: string): Promise<void> {
    await mkdir(dir, { recursive: true, mode: this.dirMode })
  }

  private async filePath(key: string): Promise<string> {
    const hash = sha256Hex(this.withPrefix(key))
    const shard1 = hash.slice(0, 2)
    const shard2 = hash.slice(2, 4)
    const dir = path.join(this.cacheDir(), shard1, shard2)
    await this.ensureDir(dir)
    return path.join(dir, `${hash}.json`)
  }

  private lockFilePath(name: string): string {
    const hash = sha256Hex(this.withPrefix(name))
    const dir = this.lockDir()
    void this.ensureDir(dir)
    return path.join(dir, `${hash}.lock`)
  }

  private withPrefix(key: string): string {
    return this.prefix.length > 0 ? `${this.prefix}:${key}` : key
  }

  private async atomicWrite(file: string, body: string): Promise<void> {
    const tmp = `${file}.tmp-${crypto.randomUUID()}`
    await writeFile(tmp, body, 'utf8')
    await rename(tmp, file)
  }

  private async safeUnlink(file: string): Promise<void> {
    try {
      await rm(file)
    } catch {
      // ignore
    }
  }
}
