# Imagen simple para desarrollo local usando el servidor de desarrollo
# de Vite (con hot reload). No pensada para producción todavía.
FROM node:20-slim

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm install

COPY . .

EXPOSE 5173

CMD ["npm", "run", "dev"]
