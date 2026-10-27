FROM node:20-alpine
WORKDIR /app
COPY analytics-server.js ./server.js
COPY resource-requests.js ./resource-requests.js
COPY study-checkins.js ./study-checkins.js
COPY update-batches.js ./update-batches.js
RUN mkdir -p /app/data
EXPOSE 3000
CMD ["node", "server.js"]
