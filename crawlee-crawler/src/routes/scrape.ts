// https://crawlee.dev/js/docs/guides/running-in-web-server

import { CheerioCrawler, EnqueueStrategy, log } from "crawlee";
import { FastifyReply, FastifyRequest } from "fastify";
import { randomUUID } from "node:crypto";
import z from "zod";
import TurndownService from 'turndown'

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

const EN_PAGES = [
  /^https?:\/\/[^\/]+\/en\/.*$/
]

const OTHER_LANG_PAGES = [
  /^https?:\/\/[^\/]+\/(nl|fr|de|es|it|pt|da|sv|no|pl|cs|hu|ru|zh|ja|ko)\/.*$/
]

export const scrapeHandler = async (
  req: FastifyRequest<{ Body: z.infer<typeof scrapeSchema> }>,
  res: FastifyReply,
) => {
  try {
    const results: string[] = [];
    const turndownService = new TurndownService()
    const crawler = new CheerioCrawler({
      requestHandler: async ({ request, $, enqueueLinks }) => {
        const title = $("title")
        log.info(`Page title: ${title.first().text()} on ${request.url}`);
        await enqueueLinks({
          regexps: [...COMMON_PAGES, ...EN_PAGES],
          exclude: [...SOCIAL_MEDIA_DOMAINS, ...OTHER_LANG_PAGES ],
          strategy: EnqueueStrategy.SameHostname,
        });
        $('header').remove()
        $('script').remove()
        $('img').remove()
        $('svg').remove()
        $('style').remove()
        $('nav').remove()
        $('footer').remove()
        $('noscript').remove()
        const body = $('body')
        const content = `${title.first()}\n${body.html()}`
        const markdown = turndownService.turndown(content)
        results.push(markdown)
      },
      maxRequestsPerCrawl: 10,
    });

    await crawler.run([req.body.url]);
    res
      .code(200)
      .header("content-type", "application/json")
      .send({content: results.join('\n')});
  } catch (error) {
    req.log.error(error);
    res.code(500).send({ error: (error as Error).message });
  }
};
