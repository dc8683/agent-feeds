import { getEnabledUsers } from '../db/repositories/users';
import { getSetting } from '../db/repositories/settings';
import { Platform } from '@agent-feeds/shared';

type FetchCallback = (platform: string, userId: string) => Promise<void>;

export class FetchScheduler {
  private timers: Map<string, NodeJS.Timeout> = new Map();
  private callback: FetchCallback | null = null;
  private circuitBreakers: Map<string, { failures: number; pausedUntil: number | null }> = new Map();

  onFetch(cb: FetchCallback): void {
    this.callback = cb;
  }

  async start(): Promise<void> {
    const intervalMin = parseInt(await this.getSettingVal('fetch_interval_minutes', '30'));
    const users = await getEnabledUsers();

    if (users.length === 0) {
      console.log('Scheduler: no enabled users, skipping');
      return;
    }

    const platforms = [...new Set(users.map(u => u.platform))];
    const staggerMs = Math.max(60000, (intervalMin * 60 * 1000) / platforms.length);

    platforms.forEach((platform, i) => {
      const usersOnPlatform = users.filter(u => u.platform === platform);
      if (usersOnPlatform.length === 0) return;

      const run = async () => {
        // Check circuit breaker
        const cb = this.circuitBreakers.get(platform);
        if (cb && cb.pausedUntil && Date.now() < cb.pausedUntil) {
          console.log(`[${platform}] Circuit breaker active, skipping cycle`);
          return;
        }

        let success = true;
        for (const user of usersOnPlatform) {
          if (this.callback) {
            try {
              await this.callback(platform, user.id);
            } catch (err: any) {
              success = false;
              if (err.status === 429) {
                this.recordFailure(platform);
              }
            }
          }
        }
        if (success) this.resetBreaker(platform);
      };

      // First run staggered
      setTimeout(run, i * staggerMs);

      // Periodic run
      const timer = setInterval(run, intervalMin * 60 * 1000);
      this.timers.set(platform, timer);
    });

    console.log(`Scheduler started: ${platforms.length} platforms, ${intervalMin}min interval`);
  }

  stop(): void {
    this.timers.forEach(t => clearInterval(t));
    this.timers.clear();
  }

  private recordFailure(platform: string): void {
    const cb = this.circuitBreakers.get(platform) || { failures: 0, pausedUntil: null };
    cb.failures++;
    if (cb.failures >= 5) {
      cb.pausedUntil = Date.now() + 6 * 60 * 60 * 1000; // 6 hours
      console.log(`[${platform}] Circuit breaker: paused for 6 hours`);
    }
    this.circuitBreakers.set(platform, cb);
  }

  private resetBreaker(platform: string): void {
    this.circuitBreakers.set(platform, { failures: 0, pausedUntil: null });
  }

  private getSettingVal(key: string, defaultVal: string): Promise<string> {
    return getSetting(key).then(v => v || defaultVal);
  }
}
