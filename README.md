# HTML-to-Image webservice
Simple webservice to create screenshots/images of a webpage (URL or HTML-input).  
The webservice can be run locally or as a container, and exposes a simple endpoint on your network on port `3033`.  
Source availabe on [github](https://github.com/monkeyphysics/html-to-image) and container available on [docker](https://hub.docker.com/r/monkeyphysics/html-to-image).  
Inspired by [nevermendel/chrome-headless-screenshots](https://github.com/NeverMendel/chrome-headless-screenshots).

## Running the service
The container is available on docker-hub as [`monkeyphysics/html-to-image`](https://hub.docker.com/r/monkeyphysics/html-to-image).

### Docker-compose
Add the container as a service to your `docker-compose.yml`:
```
htmltoimage:
    image: 'monkeyphysics/html-to-image'
    container_name: htmltoimage
```
The webservice is now available to your other services on `http://htmltoimage:3033/`.  
You can optionally expose the port to your local machine if you want to play around with the webservice:
```
htmltoimage:
    image: 'monkeyphysics/html-to-image'
    container_name: htmltoimage
    ports:
      - "3033:3033"
```

### Docker run
Run the service and cleanup after (`--rm`) exposing port `3033` on your local machine:
- `docker run --rm -p 3033:3033 monkeyphysics/html-to-image`

### Locally
You can also directly run [the app](https://github.com/monkeyphysics/html-to-image) (not using a container). This requires you to have Chrome/Chromium installed locally.
- make sure dependencies are installed `npm install` (only once, or after updating)
- run the app with `node app.js`

## API
### Request
There is only one endpoint at the root of the webservice `/`. This endpoint only accepts `POST` requests.  
The request should be of `Content-Type: application/json` (and use that header).  
The request body (JSON-object) has two properties:
- `html` (**string**, _required_): a URL or HTML as string
- `format` (**string**, _required_): one of `png`, `jpg`/`jpeg`, or `webp`
- `options` (**object**, _optional_): configurable options
  - `width` (**numeric**, _optional_): width of the browser window (screenshot)
  - `height` (**numeric**, _optional_): height of the browser window (screenshot)
  - `screenshotArgs` (**object**, _optional_): an object of options passed to [puppeteer.page.screenshot](https://pptr.dev/#?product=Puppeteer&show=api-pagescreenshotoptions)

### Response
The response body contains the image as binary data (http status code `200`).  
When something goes wrong you should receive a JSON body describing the error (http status code `4xx` or `5xx`).

## Examples
Simply test the webservice with curl when running locally or with the container port exposed.

### HTML: Hello world 
```
curl \
    --header "Content-Type: application/json" \
    --request POST \
    --data '{ "html": "<h1>Hello</h1><h2>world</h2>" }' \
    --output ~/helloworld.jpg \
    http://localhost:3033/
```

### URL: Google
```
curl \
    --header "Content-Type: application/json" \
    --request POST \
    --data '{ "html": "https://www.google.com", "width": 1024, "screenshotArgs": { "fullPage": true } }' \
    --output ~/google.jpg \
    http://localhost:3033/
```
