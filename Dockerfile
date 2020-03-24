FROM node:lts
WORKDIR /app

RUN mkdir /app/logs
COPY package*.json ./
RUN npm ci --only=production

COPY . /app

EXPOSE 4100

CMD ["node", "src/app.js"]
