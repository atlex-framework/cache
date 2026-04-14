import { CacheException } from './CacheException.js'

export class LockTimeoutException extends CacheException {
  public constructor(lockName: string, timeout: number) {
    super(`Failed to acquire lock [${lockName}] within ${timeout} second(s).`)
    this.name = 'LockTimeoutException'
  }
}
