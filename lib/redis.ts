import IORedis from "ioredis";

const globalForRedis = globalThis as unknown as {
  redisConnection: IORedis | undefined;
};

function createConnection() {
  const url = process.env.REDIS_URL;
  if (!url) throw new Error("REDIS_URL no está configurada");

  // BullMQ requiere maxRetriesPerRequest: null en la conexión.
  // lazyConnect evita que se intente conectar a Redis en tiempo de build/import.
  return new IORedis(url, { maxRetriesPerRequest: null, lazyConnect: true });
}

export const redisConnection =
  globalForRedis.redisConnection ?? createConnection();

if (process.env.NODE_ENV !== "production") {
  globalForRedis.redisConnection = redisConnection;
}
