FROM node:20-alpine
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev 2>/dev/null || npm install --omit=dev
COPY . .
EXPOSE 4173 8787
# Default: static native-game shell; override CMD for wrangler
CMD ["python3", "-m", "http.server", "4173", "--directory", "native-game"]
