FROM node:15-buster as base

WORKDIR /app
COPY . /app
RUN npm install; npm install -g typescript ts-node

ENTRYPOINT ts-node
