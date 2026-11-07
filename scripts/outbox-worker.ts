import "dotenv/config";
import { prisma } from "@/lib/prisma";
import { publishEvent } from "@/lib/rabbitmq";

const pollIntervalMs = Number(process.env.OUTBOX_POLL_INTERVAL_MS ?? 1_000);
const maxRetries = Number(process.env.OUTBOX_MAX_RETRIES ?? 5);
let stopping = false;

process.on("SIGINT", () => { stopping = true; });
process.on("SIGTERM", () => { stopping = true; });

async function publishPendingEvents() {
  // Prevent head-of-line blocking by excluding poison-pill events exceeding max retries
  const events = await prisma.outboxEvent.findMany({
    where: { published: false, retryCount: { lt: maxRetries } },
    orderBy: { createdAt: "asc" },
    take: 50,
  });

  for (const event of events) {
    try {
      const published = await publishEvent(event.eventType, {
        id: event.id,
        eventType: event.eventType,
        aggregateType: event.aggregateType,
        aggregateId: event.aggregateId,
        payload: event.payload,
        createdAt: event.createdAt.toISOString(),
      });
      if (!published) throw new Error("RabbitMQ did not accept the message.");
      await prisma.outboxEvent.update({
        where: { id: event.id },
        data: { published: true, publishedAt: new Date(), lastError: null },
      });
      console.log(`Published ${event.eventType} ${event.id}`);
    } catch (error) {
      const newRetryCount = event.retryCount + 1;
      const errorMessage = error instanceof Error ? error.message : "Unknown RabbitMQ error";
      await prisma.outboxEvent.update({
        where: { id: event.id },
        data: { retryCount: { increment: 1 }, lastError: errorMessage },
      });
      if (newRetryCount >= maxRetries) {
        console.error(`[DEAD LETTER ALERT] Event ${event.id} (${event.eventType}) exceeded max retries (${maxRetries}): ${errorMessage}`);
      } else {
        console.error(`Could not publish ${event.eventType} ${event.id} (attempt ${newRetryCount}/${maxRetries}):`, error);
      }
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

main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exitCode = 1;
});
