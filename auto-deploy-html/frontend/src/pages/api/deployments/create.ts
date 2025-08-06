import type { NextApiRequest, NextApiResponse } from "next";
import z from "zod";
import { NetlifyAPI } from "@netlify/api";
import { env } from "../../../../env";
import crypto from "node:crypto";
import fs from "node:fs";

const requestBody = z.object({
  html: z.string().min(10),
});

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  try {
    if (req.method !== "POST" && req.method !== "OPTIONS")
      res.status(405).send({ message: "Method not allowed" });
    const { html } = requestBody.parse(req.body);

    const client = new NetlifyAPI(env.NETLIFY_PAT);
    const site = await client.createSite();

    const sha1Hash = crypto
      .createHash("sha1")
      .update(html, "utf8")
      .digest("hex");
    const deployment = await client.createSiteDeploy({
      siteId: site.id,
      body: {
        files: {
          "index.html": sha1Hash,
        },
      },
    });

    if (deployment.required?.includes(sha1Hash)) {
      console.log("required uploading...");
      await client.uploadDeployFile({
        deployId: deployment.id,
        path: "index.html",
        body: html,
      });
    }

    res.status(200).json({
      siteUrl: deployment.ssl_url ?? "",
    });
  } catch (error) {
    console.log("deployments.create.catch.error ==> ", error);
    res.status(500);
  }
}
