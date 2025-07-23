import puppeteer from 'puppeteer';
import express from 'express';
import cors from 'cors';
import crypto from 'crypto';

// ---------------------------------------------------------------------------
// Page-pool helper – keeps a fixed number of pages alive and re-uses them.
// ---------------------------------------------------------------------------
class PagePool {
  constructor(size) {
    this.size = size;
    this.available = [];
    this.queue = [];
  }

  async init(browser) {
    for (let i = 0; i < this.size; i++) {
      const page = await browser.newPage();
      this.available.push(page);
    }
  }

  async acquire() {
    if (this.available.length) {
      return this.available.pop();
    }
    return new Promise(resolve => this.queue.push(resolve));
  }

  release(page) {
    if (this.queue.length) {
      const resolve = this.queue.shift();
      resolve(page);
    } else {
      this.available.push(page);
    }
  }

  async destroy() {
    for (const page of this.available) {
      try { await page.close(); } catch (_) {}
    }
  }
}

const app = express();
const port = 3033;

// ---------------------------------------------------------------------------
// Generate a request ID for every incoming request so logs can be correlated.
// ---------------------------------------------------------------------------
app.use((req, res, next) => {
  res.locals.reqId = crypto.randomUUID();
  next();
});

const supportedFormats = {
	'png': { contentType: 'image/png', args: { type: 'png' } },
	'jpg': { contentType: 'image/jpeg', args: { type: 'jpeg' } },
	'jpeg': { contentType: 'image/jpeg', args: { type: 'jpeg' } },
	'webp': { contentType: 'image/webp', args: { type: 'webp' } },
	'pdf': { contentType: 'application/pdf' },
};

// listen on our port
app.listen(port, () => {
	console.log(`HTMLtoImage service listening on port ${port}`);
});

// cross-origin support
app.use(cors());

// parse JSON body for incoming request
app.use(express.json({ limit: '10mb' }));

// validate incoming request
app.use((req, res, next) => {
	if (req.method !== 'POST') {
		next({ status: 405, message: "Method not allowed" });
	} else if (req.get('Content-Type') != 'application/json') {
		next({ status: 415, message: "Unexpected Content-Type: only supports 'application/json'" });
	} else if (typeof req.body.source != 'string') {
		next({ status: 400, message: "Missing 'source' property in request body, or 'source' property is not a string" });
	} else if (req.body.source == '') {
		next({ status: 400, message: "Property 'source' must not be empty" });
	} else if (req.body.options && typeof req.body.options != 'object') {
		next({ status: 400, message: "Property 'options' can only be an object (or omitted)" });
	} else if (typeof req.body.format != 'string' || !supportedFormats[req.body.format]) {
		next({ status: 400, message: `Property 'format' must be one of: ${Object.keys(supportedFormats).join(', ')}` });
	} else {
		next();
	}
});

// implement the endpoint
app.post('/', async (req, res) => {
  const reqId = res.locals.reqId;
  const start = Date.now();
  try {
    const options = req.body.options || {};
    const format = supportedFormats[req.body.format]; // validated by middleware

    res.type(format.contentType);

    // Merge requested screenshot args with format defaults – *without* a path.
    options.args = Object.assign({}, options.args, format.args);

    const isPdf = req.body.format === 'pdf';
    const source = req.body.source;
    const buffer = await screenshot(source, isPdf, options, isUrl(source), reqId);

    res.end(buffer);
    console.log(`[${reqId}] ✅ Converted to ${req.body.format} (${buffer.length} bytes) in ${Date.now() - start} ms`);
  } catch (e) {
    console.error(`[${reqId}] ❌ Conversion failed:`, e);
    errorHandler(res, e);
  }
});

// error handler
const errorHandler = (res, error) => {
  // Attach requestId if available
  const stamp = res?.locals?.reqId ? `[${res.locals.reqId}] ` : '';
  console.error(`${stamp}ErrorHandler:`, error);
  res.status(error.status || 500).send({ error: error.message || "" });
};

// error handler middleware (goes last in stack)
app.use((error, req, res, next) => {
	if (error) {
		errorHandler(res, error);
	} else {
		next();
	}
});

// helper function to check if string is a URL
const isUrl = (string) => {
	try {
		const url = new URL(string);
		return url.protocol === "http:" || url.protocol === "https:";
	} catch (e) {}

	return false;
};

const SCREENSHOT_TIMEOUT = parseInt(process.env.SCREENSHOT_TIMEOUT || '60000', 10); // 60 s default

let restarting = false;

async function restartBrowser(reason) {
  if (restarting) return; // already restarting
  restarting = true;
  console.error(`Restarting browser: ${reason}`);
  try {
    if (browser) {
      try { await pagePool.destroy(); } catch (_) {}
      try { await browser.close(); } catch (_) {}
    }
  } finally {
    await launchBrowser();
    restarting = false;
  }
}

const screenshot = async (source, isPdf, options, sourceIsUrl, reqId='n/a') => {
  const page = await pagePool.acquire();
  try {
    page.setDefaultTimeout(SCREENSHOT_TIMEOUT);
    page.setDefaultNavigationTimeout(SCREENSHOT_TIMEOUT);

    await page.setViewport({
      width: options.width || 1920,
      height: options.height || 1080,
    });

    if (sourceIsUrl) {
      await page.goto(source, { waitUntil: 'networkidle2', timeout: SCREENSHOT_TIMEOUT });
    } else {
      await page.setContent(source, { waitUntil: 'load' });
    }

    if (isPdf) {
      return await page.pdf(Object.assign({ format: 'A4', timeout: SCREENSHOT_TIMEOUT }, options.args));
    }
    return await page.screenshot(Object.assign({ timeout: SCREENSHOT_TIMEOUT }, options.args));
  } catch (err) {
    // Detect timeout or protocol errors indicating a hung browser and restart.
    const timeoutLike = err instanceof puppeteer.errors.TimeoutError || /timed out/i.test(err.message);
    if (timeoutLike) {
      console.error(`[${reqId}] ⏱️  Screenshot timeout detected, forcing browser restart.`);
      await restartBrowser('screenshot timeout');
    }
    throw err;
  } finally {
    // Release the page back to the pool unless it crashed/closed.
    if (!page.isClosed()) pagePool.release(page);
  }
};

let browser;
let pagePool;

const POOL_SIZE = parseInt(process.env.PAGE_POOL_SIZE || '4', 10);

async function launchBrowser() {
  console.log('Launching browser...');
  browser = await puppeteer.launch({
    defaultViewport: {
      width: 1920,
      height: 1080,
    },
    protocolTimeout: SCREENSHOT_TIMEOUT + 10000, // padding
    args: [
      '--no-sandbox',
      '--no-zygote',
      '--headless',
      '--disable-gpu',
      '--disable-dev-shm-usage',
    ],
  });

  pagePool = new PagePool(POOL_SIZE);
  await pagePool.init(browser);
  console.log(`... browser ready with ${POOL_SIZE} page(s) in pool.`);

  browser.on('disconnected', async () => {
    console.error('Browser disconnected/crashed – restarting');
    try { await pagePool.destroy(); } catch (_) {}
    await launchBrowser();
  });
}

await launchBrowser();

['SIGINT', 'SIGTERM'].forEach(signal => {
  process.on(signal, async () => {
    console.log('Closing browser...');
    try { await pagePool.destroy(); } catch (_) {}
    await browser.close();
    process.exit();
  });
});
