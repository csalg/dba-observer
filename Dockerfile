FROM node:15-buster as base

WORKDIR /app
COPY . .
RUN npm install; npm install -g typescript
RUN tsc

CMD ["node", '/app/dist/scrape.js']
