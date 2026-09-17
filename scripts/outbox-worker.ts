import "dotenv/config";
import { prisma } from "@/lib/prisma";
import { publishEvent } from "@/lib/rabbitmq";

const pollIntervalMs = Number(process.env.OUTBOX_POLL_INTERVAL_MS ?? 1_000);
let stopping = false;

process.on("SIGINT", () => { stopping = true; });
process.on("SIGTERM", () => { stopping = true; });

async function publishPendingEvents() {
  const events = await prisma.outboxEvent.findMany({ where: { published: false }, orderBy: { createdAt: "asc" }, take: 50 });
  for (const event of events) {
    try {
      const published = await publishEvent(event.eventType, { id: event.id, eventType: event.eventType, aggregateType: event.aggregateType, aggregateId: event.aggregateId, payload: event.payload, createdAt: event.createdAt.toISOString() });
      if (!published) throw new Error("RabbitMQ did not accept the message.");
      await prisma.outboxEvent.update({ where: { id: event.id }, data: { published: true, publishedAt: new Date(), lastError: null } });
      console.log(`Published ${event.eventType} ${event.id}`);
    } catch (error) {
      await prisma.outboxEvent.update({ where: { id: event.id }, data: { retryCount: { increment: 1 }, lastError: error instanceof Error ? error.message : "Unknown RabbitMQ error" } });
      console.error(`Could not publish ${event.eventType} ${event.id}:`, error);
    }
  }
}

async function main() {
  console.log("Outbox worker started.");
  while (!stopping) {
    await publishPendingEvents();
    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
  }
  await prisma.$disconnect();
  console.log("Outbox worker stopped.");
}

main().catch(async (error) => { console.error(error); await prisma.$disconnect(); process.exitCode = 1; });