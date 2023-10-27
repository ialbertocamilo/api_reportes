# ----------------------------------------------------------------------------------------------------
# NODE
# ----------------------------------------------------------------------------------------------------

FROM node:18.17.0-alpine as reports_node
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE 9000
CMD ["node", "index.js"]


# ----------------------------------------------------------------------------------------------------
# NGINX
# ----------------------------------------------------------------------------------------------------

# We need an nginx container which can pass requests to our FPM container,
# as well as serve any static content.
FROM nginx:1.20-alpine as web_server_node

# We need to add our NGINX template to the container for startup,
# and configuration.
COPY docker/nginx.conf.template /etc/nginx/templates/default.conf.template