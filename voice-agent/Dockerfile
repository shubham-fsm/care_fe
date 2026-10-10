FROM node:22-slim

# git lets the agent index only tracked files of the mounted checkouts.
RUN apt-get update && apt-get install -y --no-install-recommends git \
  && rm -rf /var/lib/apt/lists/* \
  && git config --system --add safe.directory '*'

WORKDIR /app/voice-agent
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY tsconfig.json ./
COPY src ./src

# Mount the CARE checkouts and point the agent at them, e.g.
#   -v /srv/care_fe:/sources/care_fe -e CARE_FE_DIR=/sources/care_fe
#   -v /srv/care:/sources/care -e CARE_BACKEND_DIR=/sources/care
ENV PORT=8787
EXPOSE 8787
USER node
CMD ["npm", "start"]
