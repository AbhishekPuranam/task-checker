FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production


COPY . .

RUN mkdir -p /app/uploads/avatars

EXPOSE 5001

CMD ["node", "server.js"]
