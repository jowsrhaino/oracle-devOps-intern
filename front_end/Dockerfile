# Base image: lightweight nginx server for static files
FROM nginx:alpine

# Copy all frontend files to nginx's default html folder
COPY . /usr/share/nginx/html

# Expose port 80
EXPOSE 80

# Start nginx server
CMD ["nginx", "-g", "daemon off;"]
