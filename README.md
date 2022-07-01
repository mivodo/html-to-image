# HTML-to-Image webservice
Simple webservice to create screenshots/images of HTML ( [github](https://github.com/monkeyphysics/html-to-image), [docker](https://hub.docker.com/r/monkeyphysics/html-to-image) ).  
It can be run locally or as a container, and exposes a simple endpoint on your network on port `3033`.  
Inspired by [nevermendel/chrome-headless-screenshots](https://github.com/NeverMendel/chrome-headless-screenshots).

## Running the app
The container is available on docker-hub as [`monkeyphysics/html-to-image`](https://hub.docker.com/r/monkeyphysics/html-to-image).

### Docker-compose
Simply add a service to your `docker-compose.yml`:
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
Run the service and cleanup after exposing `3033` locally as `3033`:
- `docker run --rm -p 3033:3033 monkeyphysics/html-to-image`

### Locally
You can also directly run [the app](https://github.com/monkeyphysics/html-to-image) (not using a container). This requires you to have Chrome/Chromium installed locally.
- make sure dependencies are installed `npm install` (only once, or after updating)
- run the app with `node app.js`

## API
There is only one `POST` endpoint at the root of the webservice `/`.  
The request should be of `Content-Type: application/json` where the request object has two properties:
- `html` (**string**, _required_): the HTML
- `options` (**object**, _optional_): configurable options

### Options
- `options.width` (**numeric**, _optional_): width of the browser window (screenshot)
- `options.height` (**numeric**, _optional_): height of the browser window (screenshot)
- `options.format` (**string**, _optional_): one of `png`, `jpg`/`jpeg`, or `webp`
- `options.screenshotArgs` (**object**, _optional_): an object of options passed to [puppeteer.page.screenshot](https://pptr.dev/#?product=Puppeteer&show=api-pagescreenshotoptions)

## Hello world
Simple try the webservice with curl when running locally or with the container port exposed:
```
curl \
    --header "Content-Type: application/json" \
    --request POST \
    --data '{ "html": "<h1>Hello</h1><h2>world</h2>" }' \
    --output ~/test.jpg \
    http://localhost:3033/
```