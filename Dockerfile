FROM node:22-alpine AS base

WORKDIR /app

COPY package*.json ./

FROM base AS dev

ENV NODE_ENV=development

RUN npm ci

COPY . .

EXPOSE 5000

CMD ["npm", "run", "dev"]

FROM base AS build

RUN npm ci

COPY . .

RUN npm run build

FROM node:22-alpine AS prod

WORKDIR /app

ENV NODE_ENV=production

COPY package*.json ./

RUN npm ci --omit=dev

COPY --from=build /app/dist ./dist

RUN mkdir -p uploads

EXPOSE 5000

CMD ["npm", "start"]
