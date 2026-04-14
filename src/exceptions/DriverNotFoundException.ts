import { CacheException } from './CacheException.js'

export class DriverNotFoundException extends CacheException {
  public constructor(driver: string) {
    super(`Cache driver [${driver}] is not configured.`, undefined, driver)
    this.name = 'DriverNotFoundException'
  }
}
