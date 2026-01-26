# Use Node 18
FROM node:18

# Set working directory
WORKDIR /app

# Copy backend package.json and install dependencies
COPY back_end/package*.json ./
RUN npm install

# Copy backend code
COPY back_end/ ./back_end/

# Copy frontend code
COPY front_end/ ./front_end/

# MongoDB URI
ENV MONGO_URI=mongodb://mongo:27017/livepatient

# Expose backend port
EXPOSE 5000

# Start server
CMD ["node", "back_end/backend.js"]
