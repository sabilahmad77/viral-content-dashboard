FROM node:20-slim

# Install OpenSSL + build deps (Debian-based, no Alpine issues)
RUN apt-get update && apt-get install -y openssl python3 make g++ && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json ./
RUN npm install

COPY prisma ./prisma
RUN npx prisma generate

COPY . .
RUN npm run build

EXPOSE 3001

CMD ["sh", "-c", "npx prisma db push --accept-data-loss && node dist/index.js"]
