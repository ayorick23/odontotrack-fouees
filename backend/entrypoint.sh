#!/bin/sh
# Arranque del contenedor de backend (desarrollo local).
# Espera a Postgres y levanta el servidor. No aplica migraciones ni
# seeds: eso se corre a mano (ver README). El mismo entrypoint no debe
# mutar la base en producción.

set -e

echo "Esperando a que la base de datos ($DB_HOST:$DB_PORT) esté lista..."

while ! python -c "
import socket, os, sys
sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
sock.settimeout(1)
result = sock.connect_ex((os.environ['DB_HOST'], int(os.environ['DB_PORT'])))
sys.exit(0 if result == 0 else 1)
"; do
  sleep 1
done

echo "Base de datos lista. Levantando servidor de desarrollo..."
python manage.py runserver 0.0.0.0:8000
