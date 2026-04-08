import { getGmailClient } from "../gmail";
import { gmail_v1 } from "googleapis";
import { CarrierBid } from "../../entities/CarrierBid";
import { FreightRequest } from "../../entities/FreightRequest";
import { AppDataSource } from "../../config/data-source";

export class CustomerEmailService {
  private gmail: gmail_v1.Gmail;

  constructor() {
    this.gmail = getGmailClient();
  }

  async sendBestPriceToCustomer(
    freightRequest: FreightRequest,
    lowestBid: CarrierBid
  ): Promise<string> {
    const subject = `Best Price for ${freightRequest.quoteId} - $${lowestBid.price}`;
    const emailBody = this.generateBestPriceEmailTemplate(freightRequest, lowestBid);
    
    const emailMessage = this.createEmailMessage(
      freightRequest.customerEmail,
      subject,
      emailBody
    );

    try {
      const response = await this.gmail.users.messages.send({
        userId: "me",
        requestBody: {
          raw: emailMessage,
          threadId: freightRequest.threadId, // Reply in the same thread
        },
      });

      console.log(`✅ Best price email sent to ${freightRequest.customerEmail} for ${freightRequest.quoteId}`);
      return response.data.id || "";
    } catch (error: any) {
      console.error(`❌ Failed to send best price email to ${freightRequest.customerEmail}:`, error.message);
      throw new Error(`Failed to send best price email: ${error.message}`);
    }
  }

  private generateBestPriceEmailTemplate(
    freightRequest: FreightRequest,
    lowestBid: CarrierBid
  ): string {
    const carrierName = lowestBid.carrier?.name || lowestBid.carrier?.company || "a carrier";
    
    return `
Hi ${freightRequest.customerName || freightRequest.customerEmail},

Great news! We've received competitive bids for your shipment (${freightRequest.quoteId}).

**Best Price: $${lowestBid.price}**

Carrier: ${carrierName}
${lowestBid.message ? `\n${lowestBid.message}` : ""}

Would you like to proceed with this rate?

Please reply to confirm or let us know if you'd like to explore other options.

Best regards
Dispatch Team
    `.trim();
  }

  private createEmailMessage(
    to: string,
    subject: string,
    body: string
  ): string {
    const email = [
      `To: ${to}`,
      `Subject: ${subject}`,
      "Content-Type: text/plain; charset=utf-8",
      "",
      body,
    ].join("\r\n");

    return Buffer.from(email)
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
  }
}

export const customerEmailService = new CustomerEmailService();
