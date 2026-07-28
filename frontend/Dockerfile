FROM node:20-bookworm-slim AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

ARG VITE_API_URL=https://api.entech.p1ck23.ru
ARG VITE_TELEGRAM_BOT_NAME=entechsite_bot
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_TELEGRAM_BOT_NAME=$VITE_TELEGRAM_BOT_NAME

RUN rm -rf dist && npm run build

FROM node:20-bookworm-slim AS runtime

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV API_PROXY_TARGET=https://api.entech.p1ck23.ru

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY server.js ./
COPY --from=build /app/dist ./dist

EXPOSE 3000

CMD ["npm", "start"]
