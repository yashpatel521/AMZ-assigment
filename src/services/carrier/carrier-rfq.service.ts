import { freightStatusService } from "../freight/freight-status.service";
import { rfqManagerService } from "./rfq-manager.service";
import { FreightRequest } from "../../entities/FreightRequest";

export class CarrierRFQService {
  constructor() {
    // Listen for freight requests that reach details_complete status
    freightStatusService.on("details_complete", this.handleDetailsComplete.bind(this));
  }

  private async handleDetailsComplete(freightRequest: FreightRequest): Promise<void> {
    try {
      console.log(`🚀 Freight request ${freightRequest.quoteId} is complete, sending RFQs to carriers...`);
      
      // Send RFQs to selected carriers
      const rfqs = await rfqManagerService.sendRFQsForFreightRequest(freightRequest);
      
      console.log(`✅ Successfully sent ${rfqs.length} RFQs for ${freightRequest.quoteId}`);
      
      // Optional: Update freight request status to show RFQs have been sent
      // This could be a new status like "rfqs_sent"
      
    } catch (error: any) {
      console.error(`❌ Failed to process RFQs for ${freightRequest.quoteId}:`, error.message);
      // Here you could implement retry logic or error notifications
    }
  }

  async processPendingDetailsComplete(): Promise<void> {
    // This method can be called on startup to process any freight requests
    // that are already in details_complete status but haven't had RFQs sent
    try {
      const pendingRequests = await freightStatusService.getAllPendingDetailsComplete();
      
      console.log(`📋 Found ${pendingRequests.length} pending freight requests to process`);
      
      for (const request of pendingRequests) {
        // Check if RFQs have already been sent for this request
        const existingRFQs = await rfqManagerService.getRFQsByQuoteId(request.quoteId);
        
        if (existingRFQs.length === 0) {
          // No RFQs exist, send them now
          await this.handleDetailsComplete(request);
        } else {
          console.log(`⏭️ RFQs already sent for ${request.quoteId}, skipping`);
        }
      }
    } catch (error: any) {
      console.error("❌ Error processing pending details complete requests:", error.message);
    }
  }

  async getRFQStatusSummary(quoteId: string): Promise<{
    total: number;
    sent: number;
    replied: number;
    noResponse: number;
  }> {
    const rfqs = await rfqManagerService.getRFQsByQuoteId(quoteId);
    
    return {
      total: rfqs.length,
      sent: rfqs.filter(rfq => rfq.status === "sent").length,
      replied: rfqs.filter(rfq => rfq.status === "replied").length,
      noResponse: rfqs.filter(rfq => rfq.status === "no_response").length,
    };
  }
}

export const carrierRFQService = new CarrierRFQService();
