// https://crawlee.dev/js/docs/guides/running-in-web-server

import { CheerioCrawler, log } from "crawlee";
import { FastifyReply, FastifyRequest } from "fastify";
import { randomUUID } from "node:crypto";
import z from "zod";

export const scrapeSchema = z.object({
  url: z.string().url().min(1)
});

// We will bind an HTTP response that we want to send to the Request.uniqueKey
const requestsToResponses = new Map();

export const scrapeHandler = async (
  req: FastifyRequest<{ Body: z.infer<typeof scrapeSchema> }>,
  res: FastifyReply,
) => {
  try {
    const crawler = new CheerioCrawler({
      keepAlive: true,
      requestHandler: async ({ request, $ }) => {
        const title = $("title").text();
        // We will send the response here later
        log.info(`Page title: ${title} on ${request.url}`);

        res
          .code(200)
          .header('content-type', 'application/json')
          .send(JSON.stringify({title}))

        // We can delete the response from the map now to free up memory
        requestsToResponses.delete(request.uniqueKey);
      },
    });

    const crawleeRequest = { url: req.body.url, uniqueKey: randomUUID() };
    requestsToResponses.set(crawleeRequest.uniqueKey, res);
    await crawler.addRequests([crawleeRequest]);

    await crawler.run()

  } catch (error) {
    req.log.error(error);
    res.code(500).send({ error: (error as Error).message });
  }
};
