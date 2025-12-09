FROM node:18-alpine

WORKDIR /app

COPY proxy3.js .
COPY run.sh .
RUN chmod +x run.sh

EXPOSE 8080

CMD ["./run.sh"]
