FROM node:18

WORKDIR /bot

COPY . .

RUN npm install

CMD ["npm", "start"]