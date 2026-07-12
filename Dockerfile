FROM node:22-bookworm-slim AS base
WORKDIR /app

FROM base AS dev
ENV NODE_ENV=development
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE 5000
CMD ["npm", "run", "dev"]

FROM base AS build
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM base AS prod
ENV NODE_ENV=production
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/dist ./dist
RUN mkdir -p uploads
EXPOSE 5000
CMD ["npm", "start"]
