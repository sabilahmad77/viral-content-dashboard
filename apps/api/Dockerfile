FROM node:20-alpine

# Install build deps for native modules (sharp, bcrypt, etc.)
RUN apk add --no-cache python3 make g++

WORKDIR /app

# Copy package files first for better layer caching
COPY package.json ./

# Install all dependencies
RUN npm install

# Copy prisma schema and generate client
COPY prisma ./prisma
RUN npx prisma generate

# Copy rest of source
COPY . .

# Build TypeScript
RUN npm run build

# Expose port
EXPOSE 3001

# Start: push DB schema then run server
CMD ["sh", "-c", "npx prisma db push --accept-data-loss && node dist/index.js"]
