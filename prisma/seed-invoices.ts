import { PrismaClient } from "@prisma/client";
import { seedInvoices } from "../src/server/invoice-seed";

const prisma = new PrismaClient();

seedInvoices(prisma)
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
