import { mkdir, open, readFile, rm } from 'node:fs/promises'
import path from 'node:path'

import type { Lock } from '../../Lock.js'
import { Lock as BaseLock } from '../../Lock.js'

interface LockFile {
  owner: string
  expiresAt: number
}

/**
 * File-based lock using atomic `wx` creation.
 */
export class FileLock extends BaseLock implements Lock {
  public async acquire(): Promise<boolean> {
    await this.ensureDir()
    const expiresAt = Date.now() + Math.max(0, this.seconds) * 1000
    const payload: LockFile = { owner: this.owner, expiresAt }
    try {
      const fh = await open(this.name, 'wx')
      await fh.writeFile(JSON.stringify(payload), 'utf8')
      await fh.close()
      return true
    } catch (cause) {
      if ((cause as NodeJS.ErrnoException).code !== 'EEXIST') throw cause
      const current = await this.readPayload()
      if (current && current.expiresAt <= Date.now()) {
        await this.forceRelease()
        return await this.acquire()
      }
      return false
    }
  }

  public async release(): Promise<boolean> {
    const current = await this.readPayload()
    if (!current) return false
    if (current.owner !== this.owner) return false
    await this.forceRelease()
    return true
  }

  public async forceRelease(): Promise<void> {
    await rm(this.name, { force: true })
  }

  public async getCurrentOwner(): Promise<string | null> {
    const current = await this.readPayload()
    if (!current) return null
    if (current.expiresAt <= Date.now()) {
      await this.forceRelease()
      return null
    }
    return current.owner
  }

  private async ensureDir(): Promise<void> {
    const dir = path.dirname(this.name)
    await mkdir(dir, { recursive: true })
  }

  private async readPayload(): Promise<LockFile | null> {
    try {
      const body = await readFile(this.name, 'utf8')
      return JSON.parse(body) as LockFile
    } catch (cause) {
      if ((cause as NodeJS.ErrnoException).code === 'ENOENT') return null
      return null
    }
  }
}
