import { bidDeadlineService } from "./bid-deadline.service";
import { followupEmailService } from "./followup-email.service";
import { AppDataSource } from "../../config/data-source";
import { CarrierRFQ } from "../../entities/CarrierRFQ";
import { CarrierBid } from "../../entities/CarrierBid";

export class BidFollowupOrchestratorService {
  private rfqRepository = AppDataSource.getRepository(CarrierRFQ);

  async processExpiredRFQsAndSendFollowups(): Promise<{
    processed: number;
    followupsSent: number;
    quotesProcessed: string[];
  }> {
    console.log("🔍 Checking for expired RFQs...");
    
    const { processed, quotesForFollowup } = await bidDeadlineService.processExpiredRFQs();
    
    let followupsSent = 0;
    const quotesProcessed: string[] = [];

    // Process quotes with enough bids - send follow-up to non-lowest bidders
    for (const quoteId of quotesForFollowup) {
      const result = await bidDeadlineService.checkQuoteForFollowup(quoteId);
      
      if (result.hasEnoughBids && result.lowestBid) {
        console.log(`📧 Sending follow-up emails for quote ${quoteId}...`);
        console.log(`   Lowest bid: $${result.lowestBid.price} from carrier ${result.lowestBid.carrierId}`);
        console.log(`   Sending follow-ups to ${result.otherBids.length} other carriers`);
        
        const followupResults = await followupEmailService.sendFollowupEmails(
          result.otherBids,
          result.lowestBid.price,
          quoteId
        );
        
        followupsSent += followupResults.length;
        quotesProcessed.push(quoteId);
        
        console.log(`✅ Sent ${followupResults.length} follow-up emails for ${quoteId}`);
      }
    }

    return {
      processed,
      followupsSent,
      quotesProcessed
    };
  }

  async runFollowupCheck(): Promise<void> {
    try {
      const result = await this.processExpiredRFQsAndSendFollowups();
      
      console.log("\n📊 Follow-up Check Summary:");
      console.log(`   Processed: ${result.processed} expired RFQs`);
      console.log(`   Quotes with follow-ups: ${result.quotesProcessed.length}`);
      console.log(`   Follow-up emails sent: ${result.followupsSent}`);
      
      if (result.quotesProcessed.length === 0) {
        console.log("   No follow-ups needed at this time.");
      }
    } catch (error: any) {
      console.error("❌ Error in follow-up check:", error.message);
    }
  }

  async sendFollowupsForQuote(quoteId: string, result: {
    hasEnoughBids: boolean;
    bids: CarrierBid[];
    lowestBid: CarrierBid | null;
    otherBids: CarrierBid[];
  }): Promise<number> {
    if (!result.hasEnoughBids || !result.lowestBid) {
      return 0;
    }

    console.log(`📧 Sending follow-up emails for quote ${quoteId}...`);
    console.log(`   Lowest bid: $${result.lowestBid.price} from carrier ${result.lowestBid.carrierId}`);
    console.log(`   Sending follow-ups to ${result.otherBids.length} other carriers`);

    const followupResults = await followupEmailService.sendFollowupEmails(
      result.otherBids,
      result.lowestBid.price,
      quoteId
    );

    console.log(`✅ Sent ${followupResults.length} follow-up emails for ${quoteId}`);
    return followupResults.length;
  }
}

export const bidFollowupOrchestrator = new BidFollowupOrchestratorService();
