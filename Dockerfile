FROM node:lts-alpine

WORKDIR /app

COPY package*.json ./
COPY server.mjs ./

RUN npm ci

COPY . ./

RUN npm run build

ENV APP_HOST=0.0.0.0
ENV APP_PORT=3000

CMD ["npm", "run", "start"]