# Use Node.js 18 image
FROM node:18

# Set working directory inside container
WORKDIR /app

# Copy package.json and package-lock.json first
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy all backend code
COPY . .

# Expose the port your app runs on
EXPOSE 5000

# Start the backend server
CMD ["node", "backend.js"]
