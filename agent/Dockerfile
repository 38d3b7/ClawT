FROM --platform=linux/amd64 node:20-slim
USER root
WORKDIR /app

RUN apt-get update && apt-get install -y python3 python3-pip git curl && \
    pip3 install --break-system-packages requests openai && \
    rm -rf /var/lib/apt/lists/*

COPY package.json tsconfig.json ./
RUN npm install

COPY src/ ./src/
COPY security-config.json ./security-config.json

RUN mkdir -p /app/evolved-tools /app/evolved-skills

EXPOSE 3000

CMD ["npx", "tsx", "src/index.ts"]
