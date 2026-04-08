import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from "typeorm";

export type FreightRequestStatus = "pending_details" | "details_complete" | "quoted";

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

  /** Comma-separated list of fields still missing */
  @Column({ nullable: true })
  missingFields: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
