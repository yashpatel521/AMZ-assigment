import { AppDataSource } from "../../config/data-source";
import { CarrierRFQ, CarrierRFQStatus } from "../../entities/CarrierRFQ";
import { FreightRequest } from "../../entities/FreightRequest";
import { Carrier } from "../../entities/Carrier";
import { carrierSelectionService } from "./carrier-selection.service";
import { rfqEmailService } from "./rfq-email.service";

export class RFQManagerService {
  private rfqRepository = AppDataSource.getRepository(CarrierRFQ);

  async sendRFQsForFreightRequest(freightRequest: FreightRequest): Promise<CarrierRFQ[]> {
    // Select carriers to send RFQs to
    const carriers = await carrierSelectionService.selectCarriersForFreightRequest(freightRequest);
    
    if (carriers.length === 0) {
      console.log(`⚠️ No carriers found to send RFQs for ${freightRequest.quoteId}`);
      return [];
    }

    console.log(`📤 Sending RFQs to ${carriers.length} carriers for ${freightRequest.quoteId}`);

    // Send RFQ emails to all selected carriers
    const emailResults = await rfqEmailService.sendRFQToMultipleCarriers(freightRequest, carriers);

    // Create RFQ records in database
    const rfqRecords: CarrierRFQ[] = [];

    for (const result of emailResults) {
      const rfq = this.rfqRepository.create({
        quoteId: freightRequest.quoteId,
        sentGmailMessageId: result.messageId,
        carrierEmail: result.carrier.email,
        carrierName: result.carrier.name || result.carrier.company,
        status: "sent" as CarrierRFQStatus,
        freightRequest,
        carrier: result.carrier,
      });

      const savedRFQ = await this.rfqRepository.save(rfq);
      rfqRecords.push(savedRFQ);
    }

    console.log(`✅ Created ${rfqRecords.length} RFQ records for ${freightRequest.quoteId}`);
    return rfqRecords;
  }

  async getRFQsByQuoteId(quoteId: string): Promise<CarrierRFQ[]> {
    return this.rfqRepository.find({
      where: { quoteId },
      relations: ["carrier", "freightRequest"],
      order: { sentAt: "DESC" }
    });
  }

  async getRFQsByStatus(status: CarrierRFQStatus): Promise<CarrierRFQ[]> {
    return this.rfqRepository.find({
      where: { status },
      relations: ["carrier", "freightRequest"],
      order: { sentAt: "DESC" }
    });
  }

  async updateRFQStatus(id: string, status: CarrierRFQStatus): Promise<CarrierRFQ | null> {
    const rfq = await this.rfqRepository.findOne({ where: { id } });
    if (!rfq) {
      return null;
    }

    rfq.status = status;
    return this.rfqRepository.save(rfq);
  }

  async getRFQByMessageId(messageId: string): Promise<CarrierRFQ | null> {
    return this.rfqRepository.findOne({
      where: { sentGmailMessageId: messageId },
      relations: ["carrier", "freightRequest"]
    });
  }

  async getAllPendingRFQs(): Promise<CarrierRFQ[]> {
    return this.getRFQsByStatus("sent");
  }

  async markRFQAsReplied(id: string): Promise<CarrierRFQ | null> {
    return this.updateRFQStatus(id, "replied");
  }

  async markRFQAsNoResponse(id: string): Promise<CarrierRFQ | null> {
    return this.updateRFQStatus(id, "no_response");
  }

  // Method to check for RFQs that haven't received responses after a certain time
  async getStaleRFQs(hoursOld: number = 24): Promise<CarrierRFQ[]> {
    const cutoffTime = new Date();
    cutoffTime.setHours(cutoffTime.getHours() - hoursOld);

    return this.rfqRepository
      .createQueryBuilder("rfq")
      .where("rfq.status = :status", { status: "sent" })
      .andWhere("rfq.sentAt < :cutoffTime", { cutoffTime })
      .leftJoinAndSelect("rfq.carrier", "carrier")
      .leftJoinAndSelect("rfq.freightRequest", "freightRequest")
      .orderBy("rfq.sentAt", "ASC")
      .getMany();
  }
}

export const rfqManagerService = new RFQManagerService();
