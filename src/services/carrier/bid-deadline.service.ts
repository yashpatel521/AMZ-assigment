import { AppDataSource } from "../../config/data-source";
import { CarrierRFQ } from "../../entities/CarrierRFQ";
import { CarrierBid } from "../../entities/CarrierBid";
import { FreightRequest } from "../../entities/FreightRequest";
import { BID_DEADLINE_MINUTES, MINIMUM_BIDS_FOR_FOLLOWUP, BID_EXTENSION_SECONDS, MAX_EXTENSIONS } from "../../constants/bid.constants";

export class BidDeadlineService {
  private rfqRepository = AppDataSource.getRepository(CarrierRFQ);
  private bidRepository = AppDataSource.getRepository(CarrierBid);
  private freightRequestRepository = AppDataSource.getRepository(FreightRequest);

  async checkExpiredRFQs(): Promise<CarrierRFQ[]> {
    const deadlineTime = new Date();
    deadlineTime.setMinutes(deadlineTime.getMinutes() - BID_DEADLINE_MINUTES);

    console.log(`🔍 Checking for RFQs sent before: ${deadlineTime.toISOString()} (deadline: ${BID_DEADLINE_MINUTES} minutes ago)`);

    // Debug: Show all RFQs and their statuses
    const allRFQs = await this.rfqRepository.find({
      relations: ["freightRequest"],
      order: { sentAt: "DESC" },
      take: 10
    });
    console.log(`📋 Total RFQs in database: ${allRFQs.length}`);
    for (const rfq of allRFQs) {
      console.log(`   RFQ ${rfq.quoteId}: status=${rfq.status}, freightStatus=${rfq.freightRequest?.status}, sentAt=${rfq.sentAt?.toISOString()}`);
    }

    // Find RFQs that have passed the deadline (status "sent" or "replied")
    // Also ensure the freight request is "bid_sent", "bid_received", or "rebid" (RFQs were sent, waiting for deadline)
    const expiredRFQs = await this.rfqRepository
      .createQueryBuilder("rfq")
      .where("rfq.status IN (:...statuses)", { statuses: ["sent", "replied"] })
      .andWhere("rfq.sentAt < :deadlineTime", { deadlineTime })
      .leftJoinAndSelect("rfq.freightRequest", "freightRequest")
      .leftJoinAndSelect("rfq.carrier", "carrier")
      .andWhere("freightRequest.status IN (:...freightStatuses)", { freightStatuses: ["bid_sent", "bid_received", "rebid"] })
      .orderBy("rfq.sentAt", "ASC")
      .getMany();

    console.log(`📋 Found ${expiredRFQs.length} expired RFQs with status "sent" or "replied" and freight status "bid_sent", "bid_received", or "rebid"`);
    
    return expiredRFQs;
  }

  async getBidsForQuoteId(quoteId: string): Promise<CarrierBid[]> {
    let bids = await this.bidRepository.find({
      where: { quoteId },
      relations: ["carrier"],
      order: { price: "ASC" }
    });
    
    console.log(`📊 Found ${bids.length} bids for quoteId: ${quoteId}`);
    
    // Fallback: if no bids found by quoteId, try to find by freightRequestId
    // (for old bids that don't have quoteId populated)
    if (bids.length === 0) {
      console.log(`⚠️ No bids found by quoteId, trying freightRequestId lookup...`);
      bids = await this.bidRepository.find({
        where: { freightRequestId: quoteId },
        relations: ["carrier"],
        order: { price: "ASC" }
      });
      console.log(`📊 Found ${bids.length} bids for freightRequestId: ${quoteId}`);
    }
    
    return bids;
  }

  async checkQuoteForFollowup(quoteId: string): Promise<{
    hasEnoughBids: boolean;
    bids: CarrierBid[];
    lowestBid: CarrierBid | null;
    otherBids: CarrierBid[];
  }> {
    const bids = await this.getBidsForQuoteId(quoteId);
    const hasEnoughBids = bids.length >= MINIMUM_BIDS_FOR_FOLLOWUP;

    if (!hasEnoughBids || bids.length === 0) {
      return {
        hasEnoughBids: false,
        bids,
        lowestBid: null,
        otherBids: []
      };
    }

    const lowestBid = bids[0]; // Bids are ordered by price ASC
    const otherBids = bids.slice(1); // All bids except the lowest

    return {
      hasEnoughBids: true,
      bids,
      lowestBid,
      otherBids
    };
  }

  async markRFQAsProcessed(rfqId: string): Promise<void> {
    await this.rfqRepository.update(rfqId, { status: "processed" });
  }

  async markFreightRequestAsComplete(quoteId: string): Promise<void> {
    await this.freightRequestRepository.update(
      { quoteId },
      { status: "rebid_received" }
    );
    console.log(`✅ Marked freight request ${quoteId} as rebid_received`);
  }

  async markFreightRequestAsRebid(quoteId: string): Promise<void> {
    await this.freightRequestRepository.update(
      { quoteId },
      { status: "rebid" }
    );
    console.log(`✅ Marked freight request ${quoteId} as rebid`);
  }

  async extendDeadline(quoteId: string, rfqs: CarrierRFQ[]): Promise<boolean> {
    const freightRequest = await this.freightRequestRepository.findOne({
      where: { quoteId }
    });

    if (!freightRequest) {
      console.log(`❌ Freight request not found: ${quoteId}`);
      return false;
    }

    // Check if we've already extended max times
    if (freightRequest.extensionCount >= MAX_EXTENSIONS) {
      console.log(`⚠️ Freight request ${quoteId} has reached max extensions (${MAX_EXTENSIONS}), marking as complete`);
      return false;
    }

    // Update RFQ sentAt to extend deadline (add extension seconds)
    const extensionTime = new Date();
    extensionTime.setSeconds(extensionTime.getSeconds() + BID_EXTENSION_SECONDS);

    for (const rfq of rfqs) {
      await this.rfqRepository.update(rfq.id, { sentAt: extensionTime });
    }

    // Increment extension count
    await this.freightRequestRepository.update(
      freightRequest.id,
      { extensionCount: freightRequest.extensionCount + 1 }
    );

    console.log(`✅ Extended deadline for ${quoteId} by ${BID_EXTENSION_SECONDS}s (extension ${freightRequest.extensionCount + 1}/${MAX_EXTENSIONS})`);
    return true;
  }

  async processExpiredRFQs(): Promise<{
    processed: number;
    quotesForFollowup: string[];
  }> {
    const expiredRFQs = await this.checkExpiredRFQs();
    const quotesForFollowup: string[] = [];
    let processed = 0;

    // Group by quoteId to process each freight request once
    const quoteGroups = new Map<string, CarrierRFQ[]>();
    for (const rfq of expiredRFQs) {
      if (!quoteGroups.has(rfq.quoteId)) {
        quoteGroups.set(rfq.quoteId, []);
      }
      quoteGroups.get(rfq.quoteId)!.push(rfq);
    }

    for (const [quoteId, rfqs] of quoteGroups.entries()) {
      const result = await this.checkQuoteForFollowup(quoteId);
      
      if (result.hasEnoughBids) {
        quotesForFollowup.push(quoteId);
        console.log(`✅ Quote ${quoteId} has ${result.bids.length} bids, lowest: $${result.lowestBid?.price}`);
        
        // Mark freight request as complete for quotes with enough bids
        await this.markFreightRequestAsComplete(quoteId);
      } else {
        console.log(`⏭️ Quote ${quoteId} has ${result.bids.length} bids (need ${MINIMUM_BIDS_FOR_FOLLOWUP}), attempting deadline extension`);
        
        // Try to extend deadline
        const extended = await this.extendDeadline(quoteId, rfqs);
        
        if (!extended) {
          // If extension failed (max reached), send best available price to customer
          console.log(`⚠️ Max extensions reached for ${quoteId}, sending best available price to customer`);
          
          // Get all bids and send best price to customer
          const bids = await this.bidRepository.find({
            where: { quoteId },
            relations: ["carrier"],
            order: { price: "ASC" }
          });

          if (bids.length > 0) {
            const freightRequest = await this.freightRequestRepository.findOne({
              where: { quoteId }
            });

            if (freightRequest) {
              const { customerEmailService } = await import("../customer/customer-email.service");
              await customerEmailService.sendBestPriceToCustomer(freightRequest, bids[0]);
              console.log(`✅ Sent best available price ($${bids[0].price}) to customer: ${freightRequest.customerEmail}`);
            }
          } else {
            console.log(`⚠️ No bids available for ${quoteId}, cannot send price to customer`);
          }
          
          // Mark as complete
          await this.markFreightRequestAsComplete(quoteId);
        } else {
          // If extended, don't mark RFQs as processed - they'll be checked again
          processed++;
          continue;
        }
      }

      // Mark all RFQs for this quote as processed
      for (const rfq of rfqs) {
        await this.markRFQAsProcessed(rfq.id);
      }
      
      processed++;
    }

    return {
      processed,
      quotesForFollowup
    };
  }

  async processQuoteDeadline(quoteId: string): Promise<void> {
    console.log(`🔍 Processing deadline for quote: ${quoteId}`);

    // Get all RFQs for this quote
    const rfqs = await this.rfqRepository.find({
      where: { quoteId },
      relations: ["freightRequest", "carrier"]
    });

    if (rfqs.length === 0) {
      console.log(`❌ No RFQs found for quote: ${quoteId}`);
      return;
    }

    const result = await this.checkQuoteForFollowup(quoteId);

    if (result.hasEnoughBids) {
      console.log(`✅ Quote ${quoteId} has ${result.bids.length} bids, sending follow-ups`);
      
      // Send follow-ups via orchestrator
      const { bidFollowupOrchestrator } = await import("./bid-followup-orchestrator.service");
      await bidFollowupOrchestrator.sendFollowupsForQuote(quoteId, result);
      
      // Mark as complete
      await this.markFreightRequestAsComplete(quoteId);
    } else {
      console.log(`⏭️ Quote ${quoteId} has ${result.bids.length} bids (need ${MINIMUM_BIDS_FOR_FOLLOWUP}), attempting extension`);
      
      // Try to extend deadline
      const extended = await this.extendDeadline(quoteId, rfqs);
      
      if (!extended) {
        // If extension failed, mark as complete
        await this.markFreightRequestAsComplete(quoteId);
      } else {
        // If extended, set new timer
        const { timerManagerService } = await import("./timer-manager.service");
        timerManagerService.setTimer(quoteId, BID_EXTENSION_SECONDS * 1000);
      }
    }

    // Mark RFQs as processed
    for (const rfq of rfqs) {
      await this.markRFQAsProcessed(rfq.id);
    }

    console.log(`✅ Processed deadline for quote: ${quoteId}`);
  }
}

export const bidDeadlineService = new BidDeadlineService();
