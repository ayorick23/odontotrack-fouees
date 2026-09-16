#!/bin/sh
# Este script corre cada vez que arranca el contenedor del backend.
# Espera a que Postgres esté listo antes de aplicar migraciones, para
# evitar el error clásico de "conexión rechazada" cuando el backend
# arranca más rápido que la base de datos.

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

echo "Base de datos lista. Aplicando migraciones..."
python manage.py migrate --noinput

echo "Levantando servidor de desarrollo..."
python manage.py runserver 0.0.0.0:8000
