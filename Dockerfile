# Imagen base de Node.js oficial
FROM node:20-alpine

# Directorio de trabajo en el contenedor
WORKDIR /app

# Copiar manifiesto de dependencias
COPY package*.json ./

# Instalar dependencias de producción
RUN npm ci --only=production

# Copiar el resto del código del proyecto
COPY . .

# Puerto por defecto de Cine Majestad
ENV PORT=3000
ENV NODE_ENV=production
ENV HOST=0.0.0.0

EXPOSE 3000

# Comando de inicio del servidor
CMD ["node", "server.js"]

