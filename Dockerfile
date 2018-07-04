FROM node:8

WORKDIR /app
COPY *.json /app/
RUN npm install
COPY ./src /app/src
RUN npm run build-server

EXPOSE 8088

# Add Tini
ENV TINI_VERSION v0.18.0
ADD https://github.com/krallin/tini/releases/download/${TINI_VERSION}/tini /tini
RUN chmod +x /tini
ENTRYPOINT ["/tini", "--"]

# Run your program under Tini
CMD ["node", "dist/server/server.js"]

