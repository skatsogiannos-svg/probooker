FROM node:22-alpine
RUN apk add --no-cache openssl

WORKDIR /app

ENV NODE_ENV=production

COPY package.json package-lock.json* ./

RUN npm ci --include=dev && npm cache clean --force

COPY . .

RUN npx prisma generate \
 && npm run build \
 && npm prune --omit=dev \
 && npx prisma generate \
 && npm cache clean --force

RUN chown -R node:node /app
USER node

EXPOSE 3000

CMD ["npm", "run", "docker-start"]
