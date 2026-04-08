import { gmail_v1 } from "googleapis";
import { CarrierBid } from "../../entities/CarrierBid";
import { CarrierRFQ } from "../../entities/CarrierRFQ";
import { getGmailClient } from "../gmail";

export class FollowupEmailService {
  private gmail: gmail_v1.Gmail;

  constructor() {
    this.gmail = getGmailClient();
  }

  generateFollowupEmailTemplate(
    quoteId: string,
    lowestPrice: number,
    currentBid: CarrierBid
  ): string {
    const carrierName = currentBid.carrier?.name || currentBid.carrier?.company || "Carrier";
    
    return `
🏆 COUNTER-OFFER OPPORTUNITY - ${quoteId}

Dear ${carrierName},

Thank you for your recent quote of $${currentBid.price} for shipment ${quoteId}.

We have received competitive bids from multiple carriers, and currently have a lowest bid of $${lowestPrice}.

💡 OPPORTUNITY:
If you can beat the current lowest bid of $${lowestPrice}, we would love to work with you on this shipment.

📧 HOW TO RESPOND:
Simply reply to this email with your best rate. We're looking for competitive pricing to secure this business for you.

Thank you for your partnership and quick response!

Best regards,
AMZ Freight Team
---
This is an automated follow-up. Questions? Contact our dispatch team.
    `.trim();
  }

  async sendFollowupEmail(
    bid: CarrierBid,
    lowestPrice: number,
    quoteId: string
  ): Promise<string> {
    if (!bid.carrier?.email) {
      throw new Error(`Carrier email not found for bid ${bid.id}`);
    }

    const subject = `Re: Freight Quote Request - ${quoteId} - Can you beat $${lowestPrice}?`;
    const emailBody = this.generateFollowupEmailTemplate(quoteId, lowestPrice, bid);
    
    const emailMessage = this.createEmailMessage(
      bid.carrier.email,
      subject,
      emailBody
    );

    try {
      const requestBody: any = {
        raw: emailMessage,
      };

      // If we have a threadId from the bid, send as a reply to the thread
      if (bid.gmailThreadId) {
        requestBody.threadId = bid.gmailThreadId;
      }

      const response = await this.gmail.users.messages.send({
        userId: "me",
        requestBody,
      });

      console.log(`✅ Follow-up email sent to ${bid.carrier.email} for ${quoteId} (threadId: ${bid.gmailThreadId || 'new'})`);
      return response.data.id || "";
    } catch (error: any) {
      console.error(`❌ Failed to send follow-up email to ${bid.carrier.email}:`, error.message);
      throw new Error(`Failed to send follow-up email to ${bid.carrier.email}: ${error.message}`);
    }
  }

  async sendFollowupEmails(
    otherBids: CarrierBid[],
    lowestPrice: number,
    quoteId: string
  ): Promise<{ bid: CarrierBid; messageId: string }[]> {
    const results: { bid: CarrierBid; messageId: string }[] = [];
    
    for (const bid of otherBids) {
      try {
        const messageId = await this.sendFollowupEmail(bid, lowestPrice, quoteId);
        results.push({ bid, messageId });
      } catch (error) {
        console.error(`Failed to send follow-up to carrier ${bid.carrierId}:`, error);
        // Continue with other carriers even if one fails
      }
    }

    return results;
  }

  private createEmailMessage(to: string, subject: string, body: string): string {
    const emailLines = [
      `To: ${to}`,
      `Subject: ${subject}`,
      "MIME-Version: 1.0",
      "Content-Type: text/plain; charset=utf-8",
      "",
      body,
    ];

    return Buffer.from(emailLines.join("\n"))
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_");
  }

  generateRebidEmailTemplate(quoteId: string, rfq: CarrierRFQ): string {
    const carrierName = rfq.carrier?.name || rfq.carrier?.company || "Carrier";
    
    return `
📢 REBID REQUEST - ${quoteId}

Dear ${carrierName},

We haven't received your quote for shipment ${quoteId} yet.

This shipment is still available, and we'd love to work with you on this opportunity.

📋 SHIPMENT DETAILS:
• Quote ID: ${quoteId}
• Origin: ${rfq.freightRequest?.origin}
• Destination: ${rfq.freightRequest?.destination}
• Pickup Date: ${rfq.freightRequest?.pickupDate}

💰 PLEASE PROVIDE YOUR BEST RATE:
- Base transportation cost
- Any additional fees
- Expected transit time
- Equipment type available

📧 HOW TO RESPOND:
Simply reply to this email with your quote details.

Thank you for your partnership!

Best regards,
AMZ Freight Team
---
This is an automated rebid request. Questions? Contact our dispatch team.
    `.trim();
  }

  async sendRebidEmail(rfq: CarrierRFQ): Promise<string> {
    if (!rfq.carrier?.email) {
      throw new Error(`Carrier email not found for RFQ ${rfq.id}`);
    }

    const subject = `Re: Freight Quote Request - ${rfq.quoteId} - Still Available`;
    const emailBody = this.generateRebidEmailTemplate(rfq.quoteId, rfq);
    
    const emailMessage = this.createEmailMessage(
      rfq.carrier.email,
      subject,
      emailBody
    );

    try {
      const requestBody: any = {
        raw: emailMessage,
      };

      // If we have a threadId, send as a reply to the thread
      if (rfq.sentThreadId) {
        requestBody.threadId = rfq.sentThreadId;
      }

      const response = await this.gmail.users.messages.send({
        userId: "me",
        requestBody,
      });

      console.log(`✅ Rebid email sent to ${rfq.carrier.email} for ${rfq.quoteId} (threadId: ${rfq.sentThreadId || 'new'})`);
      return response.data.id || "";
    } catch (error: any) {
      console.error(`❌ Failed to send rebid email to ${rfq.carrier.email}:`, error.message);
      throw new Error(`Failed to send rebid email to ${rfq.carrier.email}: ${error.message}`);
    }
  }

  async sendRebidEmails(rfqs: CarrierRFQ[]): Promise<{ rfq: CarrierRFQ; messageId: string }[]> {
    const results: { rfq: CarrierRFQ; messageId: string }[] = [];
    
    for (const rfq of rfqs) {
      try {
        const messageId = await this.sendRebidEmail(rfq);
        results.push({ rfq, messageId });
      } catch (error) {
        console.error(`Failed to send rebid to carrier ${rfq.carrier?.email}:`, error);
      }
    }

    return results;
  }
}

export const followupEmailService = new FollowupEmailService();
