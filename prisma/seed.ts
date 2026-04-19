import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  await prisma.engineShowcaseDriver.deleteMany();
  await prisma.engineShowcaseScenario.deleteMany();
  await prisma.decisionLog.deleteMany();
  await prisma.loadAssignment.deleteMany();
  await prisma.interventionDraft.deleteMany();
  await prisma.activeTripMirror.deleteMany();
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
