# HTML-to-Image webservice
> 💡 **Now supports PDF**

Simple webservice to create screenshots/images or pdf of a webpage (remote URL or manually provided HTML).  
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

#### Local machine
You can also directly run [the app](https://github.com/monkeyphysics/html-to-image) (not using a container). This requires you to have Chrome/Chromium installed locally.
- make sure dependencies are installed `npm install` (only once, or after updating)
- run the app with `node app.js`

#### Docker
The provided `docker-compose.yml` defines a `htmltoimage`-service that will run the webservice through docker compose:
- `docker compose up`

## API
### Request
> ⚠️ **Deprecated arguments**: `html` and `screenshotArgs` were renamed to `source` and `args`

There is only one endpoint at the root of the webservice `/`. This endpoint only accepts `POST` requests.  
The request should be of `Content-Type: application/json` (and use that header).  
The request body (JSON-object) has both required and optional properties:
- `source` (**string**, _required_): URL or HTML
- `format` (**string**, _required_): one of `png`, `jpg`/`jpeg`, `webp`, or `pdf`
- `options` (**object**, _optional_): configurable options
  - `width` (**numeric**, _optional_, defaults to `1920`): width of the browser window (screenshot)
  - `height` (**numeric**, _optional_, defaults to `1080`): height of the browser window (screenshot)
  - `args` (**object**, _optional_, defaults to `{}`): an object of options passed to [page.screenshot](https://pptr.dev/api/puppeteer.screenshotoptions/) or [page.pdf](https://pptr.dev/api/puppeteer.pdfoptions/) (be aware: some will be overwritten interally, like `path`, `format` or `type`)

> 💡 `options.width` and `options.height` are redundant for PDFs, because the `options.args.format` (defaulting to `A4`) will override these


### Response
The response body contains the image as binary data (http status code `200`) accompanied by the applicable `Content-Type`-header.  
When something goes wrong you should receive a JSON body describing the error (http status code `4xx` or `5xx`).

## Examples
Simply test the webservice with curl when running locally or with the container port exposed.

### HTML: Hello world 
```
curl \
    --header "Content-Type: application/json" \
    --request POST \
    --data '{ "source": "<h1>Hello</h1><h2>world</h2>", "format": "jpg" }' \
    --output ~/helloworld.jpg \
    http://localhost:3033/
```

### URL: Google
```
curl \
    --header "Content-Type: application/json" \
    --request POST \
    --data '{ "source": "https://www.google.com", "format": "png", "options": { "width": 1024, "args": { "fullPage": true } } }' \
    --output ~/google.jpg \
    http://localhost:3033/
```

### PDF
```
curl \
    --header "Content-Type: application/json" \
    --request POST \
    --data '{ "source": "https://pptr.dev/api/puppeteer.pdfoptions/", "format": "pdf" }' \
    --output ~/pdfoptions.pdf \
    http://localhost:3033/
```
