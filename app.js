const puppeteer = require('puppeteer');
const express = require('express');
const path = require('path');
const fs = require('fs');
const tmp = require('tmp');

const app = express();
const port = 3033;

const supportedFormats = {
	'png': { contentType: 'image/png', screenshotTypeArg: 'png' },
	'jpg': { contentType: 'image/jpeg', screenshotTypeArg: 'jpeg' },
	'jpeg': { contentType: 'image/jpeg', screenshotTypeArg: 'jpeg' },
	'webp': { contentType: 'image/webp', screenshotTypeArg: 'webp' },
};

// listen on our port
app.listen(port, () => {
	console.log(`HTMLtoImage service listening on port ${port}`);
});

// parse JSON body for incoming request
app.use(express.json());

// validate incoming request
app.use((req, res, next) => {
	if (req.method !== 'POST') {
		next({ status: 405, message: "Method not allowed" });
	} else if (req.get('Content-Type') != 'application/json') {
		next({ status: 415, message: "Unexpected Content-Type: only supports 'application/json'" });
	} else if (typeof req.body.html != 'string') {
		next({ status: 400, message: "Missing 'html' property in request body, or 'html' property is not a string" });
	} else if (req.body.options && typeof req.body.options != 'object') {
		next({ status: 400, message: "Property 'options' can only be an object (or omitted)" });
	} else {
		next();
	}
});

// implement the endpoint
app.post('/', (req, res) => {
	const tmpinput = tmp.fileSync({ prefix: 'htmltoimage-', postfix: '.html' });
	const tmpoutput = tmp.fileSync({ prefix: 'htmltoimage-' });

	const options = req.body.options || {};
	const format = supportedFormats[options.format] || supportedFormats.jpg; // default to JPG if not set

	options.screenshotArgs = Object.assign(options.screenshotArgs || {}, { type: format.screenshotTypeArg });

	fs.writeFile(tmpinput.name, req.body.html, () => {
		screenshot('file://' + tmpinput.name, tmpoutput.name, options).then(() => {
			res.header("Content-Type", format.contentType);
			fs.createReadStream(tmpoutput.name).pipe(res).on('close', () => {
				tmpinput.removeCallback();
				tmpoutput.removeCallback();
			});
		});
	});
});

// error handler (goes last in middleware stack)
app.use((error, req, res, next) => {
	if (error) {
		res.status(error.status || 500).send({ error: error.message || "" });
	} else {
		next();
	}
});

// the actual screenshot code, using puppeteer
const screenshot = async (url, outputFile, options) => {
	const browser = await puppeteer.launch({
		defaultViewport: {
			width: options.width || 1920,
			height: options.height || 1080,
		},
		args: [
			'--no-sandbox',
			'--headless',
			'--disable-gpu',
			'--disable-dev-shm-usage',
		],
	});

	const page = await browser.newPage();

	await page.goto(url);
	await page.screenshot(Object.assign({}, options.screenshotArgs, { path: outputFile }));
	await browser.close();
}

// correctly handle CTRL+C from cli when using 'docker run'
process.on('SIGINT', function() {
    process.exit();
});
