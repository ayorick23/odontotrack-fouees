# Imagen simple para desarrollo local. No está optimizada para
# producción (eso se revisará más adelante); el objetivo aquí es que
# los 3 desarrolladores tengan exactamente el mismo entorno de backend.
FROM python:3.12-slim

# Evita que Python guarde archivos .pyc y fuerza que los logs salgan
# sin buffer (para verlos en tiempo real con "docker compose logs").
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /app

# psycopg2-binary necesita estas librerías del sistema para compilar/
# funcionar correctamente dentro del contenedor.
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq-dev \
    gcc \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

RUN chmod +x entrypoint.sh

EXPOSE 8000

ENTRYPOINT ["./entrypoint.sh"]
