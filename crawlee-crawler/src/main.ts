// // For more information, see https://crawlee.dev/
// import { CheerioCrawler, ProxyConfiguration } from 'crawlee';

// import { router } from './routes.js';

// // const startUrls = ['https://crawlee.dev'];
// const startUrls = ['https://www.bytescale.com/'];

// const crawler = new CheerioCrawler({
//     // proxyConfiguration: new ProxyConfiguration({ proxyUrls: ['...'] }),
//     requestHandler: router,
//     // Comment this option to scrape the full website.
//     maxRequestsPerCrawl: 20,
// });

// await crawler.run(startUrls);

// import { CheerioCrawler, EnqueueStrategy } from "crawlee";

// const crawler = new CheerioCrawler({
//     async requestHandler({ request, body, enqueueLinks, log }) {
//         log.info(request.url);
//         // Add all links from page to RequestQueue
//         await enqueueLinks({
//           strategy: EnqueueStrategy.SameHostname
//         });
//     },
//     maxRequestsPerCrawl: 10, // Limitation for only 10 requests (do not use if you want to crawl all links)
// });

// // Run the crawler with initial request
// await crawler.run(['https://www.bytescale.com/']);

// src/main.ts
import { CheerioCrawler, Dataset, EnqueueStrategy } from "crawlee";

const coreRoutes = [
  "^/$", // home
  "^/(home)?/?$", // /home (optional)
  "^/about-?us/?$", // /about /about-us
  "^/contact-?us/?$", // /contact /contact-us
  "^/service?s?/?$", // /service /services
];

const routeRegex = new RegExp(coreRoutes.join("|"), "i");

const crawler = new CheerioCrawler({
  // --- 1. Only enqueue matching links  ------------------------------
  async requestHandler({ $, request, enqueueLinks }) {
    // Save full page as Markdown
    const title = $("title").first().text().trim() || request.url;
    const bodyText = $("body").text().replace(/\s+/g, " ").trim();

    await Dataset.pushData({
      url: request.url,
      title,
      content: `# ${title}\n\n${bodyText}`,
    });

    console.log(request.userData);

    await enqueueLinks({
      // --- 2. Inclusion filter: keep only core pages --------------
      transformRequestFunction: (req) => {
        if (routeRegex.test(req.url)) {
          req.userData = { depth: (request.userData.depth ?? 0) + 1 };
          return req;
        }
        return false; // skip everything else
      },
      strategy: EnqueueStrategy.SameHostname,
    });
  },

  // --- 3. Global settings ------------------------------------------
  maxRequestsPerCrawl: 10_000, // safety net
  ignoreSslErrors: true,
});

// Kick-off from a single start URL (change to whatever you need)
await crawler.run(["https://www.bytescale.com/"]);
