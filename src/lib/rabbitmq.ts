import amqp, { type Channel, type ChannelModel } from "amqplib";

export const rabbitmqExchange = "ticketing.events";
export const rabbitmqQueue = "ticketing.events";

let connectionPromise: Promise<ChannelModel> | undefined;
let channelPromise: Promise<Channel> | undefined;

function rabbitmqUrl() {
  return process.env.RABBITMQ_URL ?? "amqp://ticketing:ticketing_password@localhost:5672";
}

export async function getRabbitmqChannel() {
  if (!connectionPromise) {
    connectionPromise = amqp.connect(rabbitmqUrl()).catch((error) => {
      connectionPromise = undefined;
      throw error;
    });
  }
  if (!channelPromise) {
    channelPromise = connectionPromise.then(async (connection) => {
      connection.on("close", () => { connectionPromise = undefined; channelPromise = undefined; });
      connection.on("error", () => { connectionPromise = undefined; channelPromise = undefined; });
      const channel = await connection.createChannel();
      await channel.assertExchange(rabbitmqExchange, "topic", { durable: true });
      await channel.assertQueue(rabbitmqQueue, { durable: true });
      await channel.bindQueue(rabbitmqQueue, rabbitmqExchange, "#");
      return channel;
    }).catch((error) => {
      channelPromise = undefined;
      throw error;
    });
  }
  return channelPromise;
}

export async function publishEvent(eventType: string, payload: unknown) {
  const channel = await getRabbitmqChannel();
  return channel.publish(rabbitmqExchange, eventType, Buffer.from(JSON.stringify(payload)), { contentType: "application/json", deliveryMode: 2, type: eventType });
}