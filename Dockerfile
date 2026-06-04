# Stage 1: Build
FROM node:22-alpine AS build

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
COPY env.b64 ./

# Decode env vars from base64 for Vite
RUN base64 -d env.b64 > .env.production && rm env.b64

RUN npm run build

# Stage 2: Serve
FROM nginx:alpine

# Configuration standard pour Single Page App (Nginx)
RUN echo 'server { \
    listen 80; \
    location / { \
        root /usr/share/nginx/html; \
        index index.html index.htm; \
        try_files $uri $uri/ /index.html; \
    } \
    error_page 404 /index.html; \
}' > /etc/nginx/conf.d/default.conf

COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
