// https://crawlee.dev/js/docs/guides/running-in-web-server

import { CheerioCrawler, EnqueueStrategy, log } from "crawlee";
import { FastifyReply, FastifyRequest } from "fastify";
import { randomUUID } from "node:crypto";
import z from "zod";

export const scrapeSchema = z.object({
  url: z.string().url().min(1),
});

const SOCIAL_MEDIA_DOMAINS = [
  "facebook.com",
  "twitter.com",
  "x.com",
  "linkedin.com",
  "instagram.com",
  "pinterest.com",
  "tiktok.com",
  "snapchat.com",
  "reddit.com",
];

const COMMON_PAGES = [
  /.*about.*/i,
  /.*contact.*/i,
  /.*service.*/i,
  /.*home.*/i,
  /.*company.*/i,
  /.*team.*/i,
  /.*mission.*/i,
  /.*history.*/i,
  /.*overview.*/i,
];

export const scrapeHandler = async (
  req: FastifyRequest<{ Body: z.infer<typeof scrapeSchema> }>,
  res: FastifyReply,
) => {
  try {
    const results: string[] = [];
    const crawler = new CheerioCrawler({
      // keepAlive: true,
      requestHandler: async ({ request, $, enqueueLinks }) => {
        const title = $("title").text();
        log.info(`Page title: ${title} on ${request.url}`);
        results.push(title);
        await enqueueLinks({
          regexps: [...COMMON_PAGES],
          exclude: [...SOCIAL_MEDIA_DOMAINS],
          strategy: EnqueueStrategy.SameHostname,
        });
      },
      maxRequestsPerCrawl: 10,
    });

    await crawler.run([req.body.url]);
    res
      .code(200)
      .header("content-type", "application/json")
      .send(JSON.stringify(results));
  } catch (error) {
    req.log.error(error);
    res.code(500).send({ error: (error as Error).message });
  }
};
