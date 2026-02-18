FROM node:18-alpine
ARG REBUILD_TS=2026-02-18-22-50
WORKDIR /app
# copy manifest files only to install deps
COPY package*.json ./
# prefer reproducible install; fallback to install when no lockfile
RUN npm ci --omit=dev || npm install --omit=dev
# ensure critical runtime deps present even if lock/cache失效
RUN npm install --omit=dev jsonwebtoken@^9.0.2
# copy app sources
COPY . .
ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000
CMD ["npm","start"]
