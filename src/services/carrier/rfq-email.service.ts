import { gmail_v1 } from "googleapis";
import { FreightRequest } from "../../entities/FreightRequest";
import { Carrier } from "../../entities/Carrier";
import { getGmailClient } from "../gmail";
import { BID_DEADLINE_MINUTES } from "../../constants/bid.constants";

export class RFQEmailService {
  private gmail: gmail_v1.Gmail;

  constructor() {
    this.gmail = getGmailClient();
  }

  generateRFQEmailTemplate(freightRequest: FreightRequest): string {
    const { quoteId, origin, destination, freightType, weight, dimensions, pieces, pickupDate } = freightRequest;
    
    return `
🚚 FREIGHT REQUEST FOR QUOTE - ${quoteId}

Dear Carrier,

We have a new freight opportunity that matches your services. Please review the details below and provide your best competitive quote.

📋 SHIPMENT DETAILS:
• Quote ID: ${quoteId}
• Origin: ${origin}
• Destination: ${destination}
• Freight Type: ${freightType}
• Weight: ${weight}
• Dimensions: ${dimensions}
• Pieces: ${pieces}
• Pickup Date: ${pickupDate}

💰 QUOTATION REQUIREMENTS:
Please reply with your best rate including:
- Base transportation cost
- Any additional fees (fuel, accessorial, etc.)
- Expected transit time
- Equipment type available

📅 RESPONSE DEADLINE:
Please respond within ${BID_DEADLINE_MINUTES} minutes to be considered for this shipment.

📧 HOW TO RESPOND:
Simply reply to this email with your quote details. Make sure to include your company name and contact information.

Thank you for your partnership!

Best regards,
AMZ Freight Team
---
This is an automated request. Questions? Contact our dispatch team.
    `.trim();
  }

  async sendRFQToCarrier(freightRequest: FreightRequest, carrier: Carrier): Promise<string> {
    const subject = `Freight Quote Request - ${freightRequest.quoteId} - ${freightRequest.origin} to ${freightRequest.destination}`;
    const emailBody = this.generateRFQEmailTemplate(freightRequest);
    
    const emailMessage = this.createEmailMessage(
      carrier.email,
      subject,
      emailBody
    );

    try {
      const response = await this.gmail.users.messages.send({
        userId: "me",
        requestBody: {
          raw: emailMessage,
        },
      });

      console.log(`✅ RFQ sent to ${carrier.email} for ${freightRequest.quoteId}`);
      return response.data.id || "";
    } catch (error: any) {
      console.error(`❌ Failed to send RFQ to ${carrier.email}:`, error.message);
      throw new Error(`Failed to send RFQ to ${carrier.email}: ${error.message}`);
    }
  }

  async sendRFQToMultipleCarriers(freightRequest: FreightRequest, carriers: Carrier[]): Promise<{ carrier: Carrier; messageId: string }[]> {
    const results: { carrier: Carrier; messageId: string }[] = [];
    
    for (const carrier of carriers) {
      try {
        const messageId = await this.sendRFQToCarrier(freightRequest, carrier);
        results.push({ carrier, messageId });
      } catch (error) {
        console.error(`Failed to send RFQ to ${carrier.email}:`, error);
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

  async checkRFQResponses(messageId: string): Promise<any> {
    try {
      const response = await this.gmail.users.messages.get({
        userId: "me",
        id: messageId,
      });

      return response.data;
    } catch (error: any) {
      console.error(`❌ Failed to check RFQ response for message ${messageId}:`, error.message);
      throw error;
    }
  }
}

export const rfqEmailService = new RFQEmailService();
