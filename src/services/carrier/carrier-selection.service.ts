import { AppDataSource } from "../../config/data-source";
import { Carrier } from "../../entities/Carrier";
import { FreightRequest } from "../../entities/FreightRequest";

export class CarrierSelectionService {
  private carrierRepository = AppDataSource.getRepository(Carrier);

  async getAllCarriers(): Promise<Carrier[]> {
    return this.carrierRepository.find({
      order: { createdAt: "DESC" }
    });
  }

  async selectCarriersForFreightRequest(freightRequest: FreightRequest): Promise<Carrier[]> {
    // For now, return all active carriers
    // In the future, this could be enhanced with:
    // - Route matching (carriers that serve specific origins/destinations)
    // - Freight type specialization
    // - Performance ratings
    // - Availability checks
    
    const carriers = await this.getAllCarriers();
    
    // Filter out any carriers without email addresses
    return carriers.filter(carrier => 
      carrier.email && 
      carrier.email.trim() !== "" &&
      this.isValidEmail(carrier.email)
    );
  }

  async getCarriersByCompany(company: string): Promise<Carrier[]> {
    return this.carrierRepository.find({
      where: { company },
      order: { createdAt: "DESC" }
    });
  }

  async getCarrierByEmail(email: string): Promise<Carrier | null> {
    return this.carrierRepository.findOne({
      where: { email }
    });
  }

  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  // Future enhancement methods:
  async selectCarriersByRoute(origin: string, destination: string): Promise<Carrier[]> {
    // This would match carriers based on their service routes
    // For now, return all carriers
    return this.getAllCarriers();
  }

  async selectCarriersByFreightType(freightType: string): Promise<Carrier[]> {
    // This would match carriers based on freight type specialization
    // For now, return all carriers
    return this.getAllCarriers();
  }
}

export const carrierSelectionService = new CarrierSelectionService();
