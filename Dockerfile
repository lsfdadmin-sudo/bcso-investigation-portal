FROM node:22-bookworm-slim

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

ENV NODE_ENV=production
ENV PORT=4317
ENV DATA_DIR=/app/data

EXPOSE 4317
VOLUME ["/app/data"]

CMD ["npm", "start"]
