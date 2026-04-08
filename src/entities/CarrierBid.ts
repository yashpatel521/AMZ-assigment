import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, CreateDateColumn } from "typeorm";
import { FreightRequest } from "./FreightRequest";
import { Carrier } from "./Carrier";
import { CarrierRFQ } from "./CarrierRFQ";

@Entity()
export class CarrierBid {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ nullable: true })
  quoteId: string;

  @ManyToOne(() => FreightRequest, { onDelete: "CASCADE" })
  freightRequest: FreightRequest;

  @Column()
  freightRequestId: string;

  @ManyToOne(() => Carrier, { onDelete: "CASCADE" })
  carrier: Carrier;

  @Column()
  carrierId: number;

  @ManyToOne(() => CarrierRFQ, { onDelete: "CASCADE", nullable: true })
  rfq: CarrierRFQ;

  @Column({ nullable: true })
  rfqId: string;

  @Column({ type: "decimal", precision: 10, scale: 2 })
  price: number;

  @Column({ type: "text", nullable: true })
  message: string;

  @Column({ type: "text", nullable: true })
  rawEmailBody: string;

  @Column({ type: "text", nullable: true })
  extractedDetails: string;

  @Column({ default: "initial" })
  phase: string;

  @Column({ type: "text", nullable: true })
  additionalFees: string;

  @Column({ type: "text", nullable: true })
  transitTime: string;

  @Column({ type: "text", nullable: true })
  equipmentType: string;

  @Column()
  gmailMessageId: string;

  @Column()
  gmailThreadId: string;

  @CreateDateColumn()
  receivedAt: Date;
}
