FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

# Copy shared directory first
COPY ../../shared /app/shared

COPY . .

EXPOSE 5005

CMD ["node", "server.js"]
