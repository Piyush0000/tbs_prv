# Use Node.js 22
FROM node:22-slim

# Set working directory
WORKDIR /app

# Copy server directory's package files
COPY server/package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy entire server directory
COPY server/ ./

# Create uploads directory
RUN mkdir -p uploads

# Expose port 8080
EXPOSE 8080

# Set environment
ENV NODE_ENV=production

# Start the application (index.js hai na server.js nahi)
CMD ["node", "index.js"]
