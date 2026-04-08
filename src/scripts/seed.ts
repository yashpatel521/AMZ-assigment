import "reflect-metadata";
import { AppDataSource } from "../config/data-source";
import { Customer } from "../entities/Customer";
import { Carrier } from "../entities/Carrier";

async function seed() {
  await AppDataSource.initialize();
  console.log("💿 Connected to SQLite Database");

  const customerRepo = AppDataSource.getRepository(Customer);
  const carrierRepo = AppDataSource.getRepository(Carrier);

  // ─── Seed Customers ───────────────────────────────────────────────────────
  const customers = [{ email: "group4559@gmail.com", name: "AMZ Customer" }];

  for (const c of customers) {
    const exists = await customerRepo.findOne({ where: { email: c.email } });
    if (!exists) {
      await customerRepo.save(customerRepo.create(c));
      console.log(`✅ Customer seeded: ${c.email}`);
    } else {
      console.log(`⏭️  Customer already exists: ${c.email}`);
    }
  }

  // ─── Seed Carriers ────────────────────────────────────────────────────────
  const carriers = [
    { email: "livexa.patel@gmail.com", name: "Livexa Patel" },
    { email: "yash.patel.14599@gmail.com", name: "Yash Patel" },
  ];

  for (const c of carriers) {
    const exists = await carrierRepo.findOne({ where: { email: c.email } });
    if (!exists) {
      await carrierRepo.save(carrierRepo.create(c));
      console.log(`✅ Carrier seeded: ${c.email}`);
    } else {
      console.log(`⏭️  Carrier already exists: ${c.email}`);
    }
  }

  console.log("\n🎉 Seed complete!");
  await AppDataSource.destroy();
}

seed().catch(console.error);
