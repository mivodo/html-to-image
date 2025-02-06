FROM alpine:3

# Installs latest Chromium package.
RUN apk add --no-cache \
      chromium \
      nss \
      freetype \
      harfbuzz \
      ca-certificates \
      ttf-freefont \
      nodejs \
      npm

# Tell Puppeteer to skip installing Chrome. We'll be using the installed package.
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

# Copy current directory to /usr/src/app
ADD ./ /usr/src/app

# Install dependencies
WORKDIR /usr/src/app
RUN cd /usr/src/app && npm install

ENV PATH="/usr/src/app:${PATH}"

EXPOSE 3033

ENTRYPOINT ["node", "/usr/src/app/app.js"]
