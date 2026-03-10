# Dockerfile — JobPilot Worker
# Runs the Playwright apply worker on Railway

FROM mcr.microsoft.com/playwright:v1.44.0-jammy

WORKDIR /app

# Copy package files
COPY package.json ./

# Install only production deps (no Next.js needed on worker)
RUN npm install --omit=dev

# Install Playwright browsers
RUN npx playwright install chromium --with-deps

# Copy worker scripts
COPY scripts/ ./scripts/
COPY lib/ ./lib/

# Start the worker
CMD ["node", "scripts/worker.js"]
