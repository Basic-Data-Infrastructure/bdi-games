#!/bin/sh
# Starts the game API and nginx in one container. When either stops, the
# container stops, so the platform restarts both together.
set -eu

cd /app/services/game-api
# Only nginx is reachable from outside; the API listens on loopback.
LISTEN_HOST=127.0.0.1 PORT=8787 node --import tsx src/index.ts &
api=$!

nginx -e /dev/stderr -g 'daemon off;' &
web=$!

stopping=0
stop() {
  stopping=1
  kill -TERM "$api" 2>/dev/null || true
  kill -QUIT "$web" 2>/dev/null || true
}
trap stop TERM INT

while [ "$stopping" = 0 ] && kill -0 "$api" 2>/dev/null && kill -0 "$web" 2>/dev/null; do
  # Sleeping in the background keeps the shell free to run the trap the moment a signal arrives.
  sleep 1 &
  wait $! || true
done

crashed=0
[ "$stopping" = 1 ] || crashed=1
stop
# On SIGTERM the API writes pending sessions to Postgres before it exits; wait for that.
wait "$api" 2>/dev/null || true
wait "$web" 2>/dev/null || true
exit "$crashed"
