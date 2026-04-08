import { Entity, PrimaryColumn, Column } from "typeorm";

@Entity()
export class Setting {
  @PrimaryColumn()
  key: string;

  @Column({ type: "text", nullable: true })
  value: string;
}
