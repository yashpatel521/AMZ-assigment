import { bidDeadlineService } from "./bid-deadline.service";

export class TimerManagerService {
  private activeTimers: Map<string, NodeJS.Timeout> = new Map();

  setTimer(quoteId: string, delayMs: number): void {
    // Clear existing timer if any
    this.clearTimer(quoteId);

    console.log(`⏰ Setting timer for ${quoteId} (${delayMs}ms)`);

    const timer = setTimeout(async () => {
      console.log(`⏰ Timer fired for ${quoteId}`);
      await this.handleTimerExpiry(quoteId);
      this.activeTimers.delete(quoteId);
    }, delayMs);

    this.activeTimers.set(quoteId, timer);
  }

  clearTimer(quoteId: string): void {
    const existingTimer = this.activeTimers.get(quoteId);
    if (existingTimer) {
      clearTimeout(existingTimer);
      this.activeTimers.delete(quoteId);
      console.log(`⏰ Cleared timer for ${quoteId}`);
    }
  }

  clearAllTimers(): void {
    for (const [quoteId, timer] of this.activeTimers) {
      clearTimeout(timer);
    }
    this.activeTimers.clear();
    console.log(`⏰ Cleared all timers`);
  }

  private async handleTimerExpiry(quoteId: string): Promise<void> {
    try {
      console.log(`🔍 Processing expired quote: ${quoteId}`);
      await bidDeadlineService.processQuoteDeadline(quoteId);
    } catch (error: any) {
      console.error(`❌ Error processing timer expiry for ${quoteId}:`, error.message);
    }
  }

  getActiveTimersCount(): number {
    return this.activeTimers.size;
  }
}

export const timerManagerService = new TimerManagerService();
