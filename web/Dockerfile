FROM node:20-alpine AS builder

WORKDIR /app
COPY package*.json ./
# Copy prisma schema before npm install so the postinstall
# script (prisma generate) can find it during dependency setup.
COPY prisma ./prisma/
RUN npm install --legacy-peer-deps
COPY . .
RUN npx prisma generate
RUN npm run build

FROM node:20-alpine AS runner

WORKDIR /app
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

EXPOSE 3000
CMD ["node", "server.js"]
