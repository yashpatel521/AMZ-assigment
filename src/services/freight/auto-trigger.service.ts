import { AppDataSource } from "../../config/data-source";
import { FreightRequest } from "../../entities/FreightRequest";
import { CarrierRFQ } from "../../entities/CarrierRFQ";
import { rfqManagerService } from "../carrier/rfq-manager.service";
import { bidDeadlineService } from "../carrier/bid-deadline.service";

export class AutoTriggerService {
  private freightRequestRepository = AppDataSource.getRepository(FreightRequest);
  private rfqRepository = AppDataSource.getRepository(CarrierRFQ);

  async processStuckFreightRequests(): Promise<{
    processed: number;
    details: string[];
  }> {
    const details: string[] = [];
    let processed = 0;

    // Check for freight requests stuck at details_complete (RFQs not sent)
    const stuckDetailsComplete = await this.freightRequestRepository.find({
      where: { status: "details_complete" as any }
    });

    for (const freightRequest of stuckDetailsComplete) {
      try {
        // Check if RFQs were already sent
        const existingRFQs = await this.rfqRepository.find({
          where: { quoteId: freightRequest.quoteId }
        });

        if (existingRFQs.length === 0) {
          console.log(`🔄 Auto-triggering RFQs for stuck freight request: ${freightRequest.quoteId}`);
          await rfqManagerService.sendRFQsForFreightRequest(freightRequest);
          details.push(`Sent RFQs for ${freightRequest.quoteId}`);
          processed++;
        }
      } catch (error: any) {
        console.error(`❌ Failed to process ${freightRequest.quoteId}:`, error.message);
        details.push(`Failed to process ${freightRequest.quoteId}: ${error.message}`);
      }
    }

    return {
      processed,
      details
    };
  }

  async checkStatusConsistency(): Promise<{
    fixed: number;
    details: string[];
  }> {
    const details: string[] = [];
    let fixed = 0;

    // Check if freight requests with bid_received should have been processed
    const bidReceivedRequests = await this.freightRequestRepository.find({
      where: { status: "bid_received" as any }
    });

    for (const freightRequest of bidReceivedRequests) {
      // Check if it's been too long in bid_received status (more than 2x deadline)
      const deadlineTime = new Date(freightRequest.updatedAt);
      deadlineTime.setMinutes(deadlineTime.getMinutes() + (2 * 1)); // 2x 1-minute deadline

      if (new Date() > deadlineTime) {
        console.log(`⚠️ Freight request ${freightRequest.quoteId} stuck in bid_received, forcing to rebid`);
        await this.freightRequestRepository.update(
          freightRequest.id,
          { status: "rebid" as any }
        );
        details.push(`Forced ${freightRequest.quoteId} to rebid status`);
        fixed++;
      }
    }

    return {
      fixed,
      details
    };
  }

  async runAutoTriggers(): Promise<void> {
    try {
      console.log("🤖 Running auto-triggers...");

      // Process stuck freight requests
      const stuckResult = await this.processStuckFreightRequests();
      
      // Check status consistency
      const consistencyResult = await this.checkStatusConsistency();

      console.log("\n📊 Auto-Trigger Summary:");
      console.log(`   Stuck requests processed: ${stuckResult.processed}`);
      console.log(`   Status fixes applied: ${consistencyResult.fixed}`);

      if (stuckResult.details.length > 0) {
        console.log("   Details:", stuckResult.details);
      }

      if (consistencyResult.details.length > 0) {
        console.log("   Fixes:", consistencyResult.details);
      }

      if (stuckResult.processed === 0 && consistencyResult.fixed === 0) {
        console.log("   No auto-triggers needed at this time.");
      }
    } catch (error: any) {
      console.error("❌ Error in auto-triggers:", error.message);
    }
  }
}

export const autoTriggerService = new AutoTriggerService();
