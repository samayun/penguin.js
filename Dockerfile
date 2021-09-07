FROM node:14

WORKDIR /home/app

COPY package*.json ./

RUN npm install

ENV PORT=5000

CMD ["npm", "run", "start:dev"]