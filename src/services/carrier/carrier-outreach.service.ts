import { gmail_v1 } from "googleapis";
import { AppDataSource } from "../../config/data-source";
import { Carrier } from "../../entities/Carrier";
import { FreightRequest } from "../../entities/FreightRequest";
import { CarrierRFQ } from "../../entities/CarrierRFQ";
import { MESSAGES } from "../../constants/messages";

/**
 * Sends a Rate Request (RFQ) email to every carrier in the database.
 * Stores the sent Gmail message ID and thread ID in CarrierRFQ for future tracking.
 */
export async function sendRFQToAllCarriers(
  gmail: gmail_v1.Gmail,
  freightRequest: FreightRequest,
) {
  const carrierRepo = AppDataSource.getRepository(Carrier);
  const rfqRepo = AppDataSource.getRepository(CarrierRFQ);

  const carriers = await carrierRepo.find();

  if (carriers.length === 0) {
    console.log("⚠️  No carriers found in database. Skipping RFQ emails.");
    return;
  }

  const template = MESSAGES.CARRIER_RFQ;
  const details = {
    origin: freightRequest.origin,
    destination: freightRequest.destination,
    freightType: freightRequest.freightType,
    weight: freightRequest.weight,
    dimensions: freightRequest.dimensions,
    pieces: freightRequest.pieces,
    pickupDate: freightRequest.pickupDate,
  };

  console.log(`\n🚚 Contacting ${carriers.length} carrier(s) for RFQ [${freightRequest.quoteId}]...`);

  for (const carrier of carriers) {
    try {
      const subject = template.subject(freightRequest.quoteId);
      const body = template.body(details, freightRequest.quoteId, carrier.name ?? undefined);

      const rawMessage = [
        `To: ${carrier.email}`,
        `Subject: ${subject}`,
        `Content-Type: text/plain; charset=utf-8`,
        `MIME-Version: 1.0`,
        ``,
        body,
      ].join("\r\n");

      const encoded = Buffer.from(rawMessage)
        .toString("base64")
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "");

      const sentMsg = await gmail.users.messages.send({
        userId: "me",
        requestBody: { raw: encoded },
      });

      // ─── Save the sent email record ───────────────────────────────────────
      const rfqRecord = rfqRepo.create({
        quoteId: freightRequest.quoteId,
        carrierEmail: carrier.email,
        carrierName: carrier.name,
        sentGmailMessageId: sentMsg.data.id ?? undefined,
        sentThreadId: sentMsg.data.threadId ?? undefined,
        status: "sent",
        freightRequest,
        carrier,
      });

      await rfqRepo.save(rfqRecord);

      console.log(`  ✅ RFQ sent to ${carrier.email} | Gmail ID: ${sentMsg.data.id}`);
    } catch (err: any) {
      console.error(`  ❌ Failed to send RFQ to ${carrier.email}: ${err.message}`);
    }
  }

  console.log(`✅ All RFQ emails dispatched for [${freightRequest.quoteId}]`);
}
