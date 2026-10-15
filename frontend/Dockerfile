# Imagen simple para desarrollo local usando el servidor de desarrollo
# de Vite (con hot reload). No pensada para producción todavía.
# Node 22 (LTS): vitest 5 no arranca en Node 20 ("webidl.util.markAsUncloneable
# is not a function"), así que con 20 los tests no corrían dentro del contenedor.
FROM node:22-slim

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm install

COPY . .

EXPOSE 5173

CMD ["npm", "run", "dev"]
