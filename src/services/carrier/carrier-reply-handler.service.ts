import { AppDataSource } from "../../config/data-source";
import { CarrierBid } from "../../entities/CarrierBid";
import { CarrierRFQ } from "../../entities/CarrierRFQ";
import { Carrier } from "../../entities/Carrier";
import { FreightRequest } from "../../entities/FreightRequest";
import { extractBidDetails } from "../llm/bid-extractor.service";
import { gmail_v1 } from "googleapis";
import { MINIMUM_BIDS_FOR_FOLLOWUP } from "../../constants/bid.constants";
import { customerEmailService } from "../customer/customer-email.service";

async function checkAndSendBestPriceToCustomer(quoteId: string, isCounterOffer: boolean = false): Promise<void> {
  const bidRepository = AppDataSource.getRepository(CarrierBid);
  const freightRequestRepository = AppDataSource.getRepository(FreightRequest);
  
  // Get all bids for this quote
  const bids = await bidRepository.find({
    where: { quoteId },
    relations: ["carrier"],
    order: { price: "ASC" }
  });

  console.log(`🔍 Checking conditions for sending price to customer for ${quoteId}...`);
  console.log(`   Total bids: ${bids.length}`);
  console.log(`   Is counter-offer: ${isCounterOffer}`);

  // Condition 1: Must have at least 1 bid
  if (bids.length === 0) {
    console.log(`❌ No bids available, cannot send price to customer`);
    return;
  }

  const lowestBid = bids[0];
  const freightRequest = await freightRequestRepository.findOne({
    where: { quoteId }
  });

  if (!freightRequest) {
    console.log(`❌ Freight request not found`);
    return;
  }

  console.log(`   Freight status: ${freightRequest.status}`);

  // Condition 2: Check if we should send to customer
  // Only send if: (1) it's a counter-offer reply OR (2) freight request is already rebid_received
  const shouldSend = isCounterOffer || freightRequest.status === "rebid_received";
  
  if (!shouldSend) {
    console.log(`⏭️ Conditions not met - not sending price to customer`);
    console.log(`   Reason: Waiting for deadline or counter-offer`);
    return;
  }

  // Condition 3: Check if price is valid
  if (!lowestBid.price || lowestBid.price <= 0) {
    console.log(`❌ Invalid price: $${lowestBid.price}`);
    return;
  }

  // All conditions met - send to customer
  console.log(`✅ All conditions met - sending price to customer`);
  console.log(`📊 Best price: $${lowestBid.price} from ${lowestBid.carrier?.name || lowestBid.carrier?.company}`);
  
  // Send email to customer with best price
  try {
    await customerEmailService.sendBestPriceToCustomer(freightRequest, lowestBid);
    console.log(`✅ Sent best price email to customer: ${freightRequest.customerEmail}`);
  } catch (error: any) {
    console.error(`❌ Failed to send best price email:`, error.message);
  }
}

export async function processCarrierReply(
  messageId: string,
  threadId: string,
  senderEmail: string,
  subject: string,
  body: string,
  gmail: gmail_v1.Gmail
): Promise<boolean> {
  try {
    console.log(`🔍 Checking if email from ${senderEmail} is a carrier reply...`);

    // Check if this email is a reply to an RFQ by matching threadId
    const rfqRepository = AppDataSource.getRepository(CarrierRFQ);
    const carrierRepository = AppDataSource.getRepository(Carrier);

    // Find RFQ by threadId
    const rfq = await rfqRepository.findOne({
      where: { sentThreadId: threadId },
      relations: ["carrier", "freightRequest"]
    });

    if (!rfq) {
      console.log(`❌ No RFQ found for threadId: ${threadId}`);
      return false;
    }

    console.log(`✅ Found RFQ: ${rfq.quoteId} for carrier: ${rfq.carrierEmail}`);

    // Verify sender matches the RFQ carrier
    if (rfq.carrierEmail !== senderEmail) {
      console.log(`⚠️ Sender email doesn't match RFQ carrier email`);
      return false;
    }

    // Extract bid details using LLM
    console.log(`🤖 Extracting bid details using LLM...`);
    const bidDetails = extractBidDetails(subject, body);

    console.log(`Extracted bid details:`, bidDetails);

    if (!bidDetails.price) {
      console.log(`⚠️ No price found in carrier email, skipping bid creation`);
      return false;
    }

    // Create CarrierBid record
    const bidRepository = AppDataSource.getRepository(CarrierBid);
    const carrier = await carrierRepository.findOne({ where: { email: senderEmail } });

    if (!carrier) {
      console.log(`❌ Carrier not found for email: ${senderEmail}`);
      return false;
    }

    const bid = new CarrierBid();
    bid.quoteId = rfq.quoteId;
    bid.freightRequestId = rfq.freightRequest.id;
    bid.carrierId = carrier.id;
    bid.rfqId = rfq.id;
    bid.price = bidDetails.price;
    bid.message = bidDetails.message || "";
    bid.rawEmailBody = body;
    bid.extractedDetails = JSON.stringify(bidDetails);
    bid.phase = "initial";
    bid.additionalFees = bidDetails.additionalFees || "";
    bid.transitTime = bidDetails.transitTime || "";
    bid.equipmentType = bidDetails.equipmentType || "";
    bid.gmailMessageId = messageId;
    bid.gmailThreadId = threadId;

    await bidRepository.save(bid);
    console.log(`✅ Saved bid: $${bidDetails.price} from ${carrier.name || carrier.company} for ${rfq.quoteId}`);

    // Check if this is a counter-offer reply (existing bid for this RFQ)
    const existingBid = await bidRepository.findOne({
      where: { rfqId: rfq.id },
      relations: ["carrier"]
    });

    if (existingBid) {
      // This is a counter-offer reply - update the existing bid
      existingBid.price = bidDetails.price;
      existingBid.message = bidDetails.message || existingBid.message;
      existingBid.rawEmailBody = body;
      existingBid.extractedDetails = JSON.stringify(bidDetails);
      existingBid.additionalFees = bidDetails.additionalFees || existingBid.additionalFees;
      existingBid.transitTime = bidDetails.transitTime || existingBid.transitTime;
      existingBid.equipmentType = bidDetails.equipmentType || existingBid.equipmentType;
      existingBid.gmailMessageId = messageId;
      existingBid.phase = "rebid";

      await bidRepository.save(existingBid);
      console.log(`✅ Updated existing bid with new price: $${bidDetails.price} (counter-offer)`);
      
      // Update RFQ status
      rfq.status = "replied";
      await rfqRepository.save(rfq);
      console.log(`✅ Updated RFQ status to 'replied'`);

      // Check if we should send best price to customer (only after deadline)
      await checkAndSendBestPriceToCustomer(rfq.quoteId, true);
      
      return true;
    }

    // Check if we have enough bids to update freight request status
    const bidCount = await bidRepository.count({
      where: { quoteId: rfq.quoteId }
    });

    if (bidCount >= MINIMUM_BIDS_FOR_FOLLOWUP) {
      const freightRequestRepository = AppDataSource.getRepository(FreightRequest);
      await freightRequestRepository.update(
        { quoteId: rfq.quoteId },
        { status: "bid_received" }
      );
      console.log(`✅ Updated freight request status to bid_received (${bidCount} bids)`);
    }

    return true;

  } catch (error: any) {
    console.error(`❌ Error processing carrier reply:`, error.message);
    return false;
  }
}
