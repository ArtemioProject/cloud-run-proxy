FROM node:18-alpine

# Directorio
WORKDIR /app

# Copiar archivos
COPY proxy.js .
COPY run.sh .

RUN chmod +x run.sh

# Puerto obligatorio de Cloud Run
ENV PORT=8080

EXPOSE 8080

CMD ["./run.sh"]
