#!/bin/bash
# Arranca el servidor web de Next.js y los workers de BullMQ (transcripción +
# resumen) como procesos hermanos dentro del mismo contenedor. Si cualquiera
# de los dos muere, se apaga todo el contenedor para que Railway lo reinicie
# limpio en vez de quedar en un estado a medias (solo web, o solo workers).
set -e

npx prisma migrate deploy

npm run start:docker &
WEB_PID=$!

npm run workers:prod &
WORKERS_PID=$!

shutdown() {
  echo "Señal de apagado recibida, cerrando procesos..."
  kill -TERM "$WEB_PID" "$WORKERS_PID" 2>/dev/null
  wait
}
trap shutdown TERM INT

wait -n "$WEB_PID" "$WORKERS_PID"
EXIT_CODE=$?
echo "Un proceso terminó (código $EXIT_CODE), apagando el contenedor..."
kill -TERM "$WEB_PID" "$WORKERS_PID" 2>/dev/null
wait
exit $EXIT_CODE
