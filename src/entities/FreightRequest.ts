import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from "typeorm";

export type FreightRequestStatus = "pending_details" | "details_complete" | "bid_sent" | "bid_received" | "rebid" | "rebid_received" | "quoted";

@Entity()
export class FreightRequest {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  /** Human-readable unique quote ID, e.g. AMZ-00042 */
  @Column({ unique: true })
  quoteId: string;

  @Column()
  customerEmail: string;

  @Column({ nullable: true })
  customerName: string;

  @Column()
  threadId: string;

  @Column()
  messageId: string;

  @Column({ nullable: true })
  subject: string;

  @Column({ type: "text", nullable: true })
  rawBody: string;

  @Column({ type: "text", nullable: true })
  customerNotes: string;

  @Column({ type: "text", nullable: true })
  extractedDetails: string;

  // ─── Freight Fields ──────────────────────────────────────────────────────

  @Column({ nullable: true })
  origin: string;

  @Column({ nullable: true })
  destination: string;

  @Column({ nullable: true })
  freightType: string;

  @Column({ nullable: true })
  weight: string;

  @Column({ nullable: true })
  dimensions: string;

  @Column({ nullable: true })
  pieces: string;

  @Column({ nullable: true })
  pickupDate: string;

  // ─── Status ──────────────────────────────────────────────────────────────

  @Column({ default: "pending_details" })
  status: FreightRequestStatus;

  /** Number of times deadline has been extended */
  @Column({ default: 0 })
  extensionCount: number;

  /** Comma-separated list of fields still missing */
  @Column({ nullable: true })
  missingFields: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
