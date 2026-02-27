FROM --platform=linux/amd64 node:20-slim
USER root
WORKDIR /app

RUN apt-get update && apt-get install -y python3 python3-pip git curl && \
    pip3 install --break-system-packages requests openai && \
    rm -rf /var/lib/apt/lists/*

COPY agent/package.json agent/tsconfig.json ./
RUN npm install

COPY agent/src/ ./src/
COPY agent/security-config.json ./security-config.json
COPY shared/ /shared/

ENV NODE_PATH=/app/node_modules

RUN mkdir -p /app/evolved-tools /app/evolved-skills

EXPOSE 3000

CMD ["npx", "tsx", "src/index.ts"]
