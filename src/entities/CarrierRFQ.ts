import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from "typeorm";
import { FreightRequest } from "./FreightRequest";
import { Carrier } from "./Carrier";

export type CarrierRFQStatus = "sent" | "replied" | "no_response";

@Entity()
export class CarrierRFQ {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  /** The quoteId this RFQ belongs to (e.g. AMZ-00001) */
  @Column()
  quoteId: string;

  /** Gmail message ID of the sent RFQ email — used to match carrier replies */
  @Column({ nullable: true })
  sentGmailMessageId: string;

  /** Gmail thread ID of the sent RFQ email */
  @Column({ nullable: true })
  sentThreadId: string;

  /** The carrier's email address */
  @Column()
  carrierEmail: string;

  /** The carrier's name (snapshot at send time) */
  @Column({ nullable: true })
  carrierName: string;

  /** Current status of this RFQ */
  @Column({ default: "sent" })
  status: CarrierRFQStatus;

  @ManyToOne(() => FreightRequest, { onDelete: "CASCADE", nullable: true })
  @JoinColumn()
  freightRequest: FreightRequest;

  @ManyToOne(() => Carrier, { onDelete: "SET NULL", nullable: true })
  @JoinColumn()
  carrier: Carrier;

  @CreateDateColumn()
  sentAt: Date;
}
