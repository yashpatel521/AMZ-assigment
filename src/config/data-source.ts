import "reflect-metadata";
import { DataSource } from "typeorm";
import { Setting } from "../entities/Setting";
import { Customer } from "../entities/Customer";
import { Carrier } from "../entities/Carrier";
import { FreightRequest } from "../entities/FreightRequest";
import { CarrierRFQ } from "../entities/CarrierRFQ";
import { CarrierBid } from "../entities/CarrierBid";

export const AppDataSource = new DataSource({
  type: "sqlite",
  database: "database.sqlite",
  synchronize: true,
  logging: false,
  entities: [Setting, Customer, Carrier, FreightRequest, CarrierRFQ, CarrierBid],
  migrations: [],
  subscribers: [],
});
