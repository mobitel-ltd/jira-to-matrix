FROM node:lts
WORKDIR /app

RUN mkdir /app/logs
COPY package*.json ./
RUN npm ci --only=production

COPY . .

CMD ["node", "dist/app.js"]
