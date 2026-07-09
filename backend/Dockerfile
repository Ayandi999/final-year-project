FROM oven/bun:1 AS base
WORKDIR /app

# Install dependencies
COPY package.json bun.lock ./
RUN bun install

# Copy source code
COPY . .

# Expose port
EXPOSE 8080

# Start server
CMD ["bun", "run", "start"]
