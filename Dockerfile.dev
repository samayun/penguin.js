FROM node:lts-alpine

WORKDIR /usr/src/app

# Install app dependencies
# A wildcard is used to ensure both package.json AND package-lock.json are copied
# where available (npm@5+)
COPY package*.json ./

RUN npm install
# If you are building your code for production
# RUN npm ci --only=production
# Bundle app source
COPY . .

ENV DB_NAME staging
ENV DB_HOST cluster0.khadd.mongodb.net
ENV DB_USER staging
ENV DB_PASSWORD staging
ENV JWT_SECRET_KEY Penguin
ENV PORT 8080

EXPOSE 8080

CMD ["npm", "run", "start"]