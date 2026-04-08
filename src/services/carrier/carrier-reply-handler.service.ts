import { AppDataSource } from "../../config/data-source";
import { CarrierBid } from "../../entities/CarrierBid";
import { CarrierRFQ } from "../../entities/CarrierRFQ";
import { Carrier } from "../../entities/Carrier";
import { extractBidDetails } from "../llm/bid-extractor.service";
import { gmail_v1 } from "googleapis";

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

    // Update RFQ status to replied
    rfq.status = "replied";
    await rfqRepository.save(rfq);
    console.log(`✅ Updated RFQ status to 'replied'`);

    return true;

  } catch (error: any) {
    console.error(`❌ Error processing carrier reply:`, error.message);
    return false;
  }
}
