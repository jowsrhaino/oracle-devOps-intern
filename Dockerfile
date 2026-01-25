# Use Node 18
FROM node:18

# Set working directory
WORKDIR /app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy backend code
COPY ./back_end ./back_end

# 🔥 COPY FRONTEND ALSO (THIS WAS MISSING)
COPY ./front_end ./front_end

# Expose port
EXPOSE 5000

# Run backend
CMD ["node", "back_end/backend.js"]
