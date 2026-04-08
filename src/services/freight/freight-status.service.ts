import { AppDataSource } from "../../config/data-source";
import { FreightRequest, FreightRequestStatus } from "../../entities/FreightRequest";
import { EventEmitter } from "events";

export class FreightStatusService extends EventEmitter {
  private static instance: FreightStatusService;
  private freightRequestRepository = AppDataSource.getRepository(FreightRequest);

  private constructor() {
    super();
  }

  static getInstance(): FreightStatusService {
    if (!FreightStatusService.instance) {
      FreightStatusService.instance = new FreightStatusService();
    }
    return FreightStatusService.instance;
  }

  async updateFreightRequestStatus(id: string, status: FreightRequestStatus): Promise<FreightRequest> {
    const freightRequest = await this.freightRequestRepository.findOne({ where: { id } });
    
    if (!freightRequest) {
      throw new Error(`FreightRequest with id ${id} not found`);
    }

    const oldStatus = freightRequest.status;
    freightRequest.status = status;
    
    const updatedRequest = await this.freightRequestRepository.save(freightRequest);
    
    // Emit event when status changes to details_complete
    if (oldStatus !== status && status === "details_complete") {
      this.emit("details_complete", updatedRequest);
    }
    
    return updatedRequest;
  }

  async getFreightRequestsByStatus(status: FreightRequestStatus): Promise<FreightRequest[]> {
    return this.freightRequestRepository.find({ 
      where: { status },
      order: { createdAt: "DESC" }
    });
  }

  async getAllPendingDetailsComplete(): Promise<FreightRequest[]> {
    return this.getFreightRequestsByStatus("details_complete");
  }
}

export const freightStatusService = FreightStatusService.getInstance();
