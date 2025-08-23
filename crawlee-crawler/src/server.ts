import fastify from "fastify";
import cors from '@fastify/cors'
import {
  serializerCompiler,
  validatorCompiler,
  ZodTypeProvider,
} from "fastify-type-provider-zod";
import { scrapeHandler, scrapeSchema } from "./routes/scrape.js";


const port = parseInt('8000');
const host = `0.0.0.0`;

const server = fastify({
  logger: {
    level: "debug",
    transport: {
      target: "pino-pretty",
      options: {
        translateTime: "HH:MM:ss Z",
        ignore: "pid,hostname",
      },
    },
  },
})
  .register(cors, {
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE']
  })

server.setValidatorCompiler(validatorCompiler);
server.setSerializerCompiler(serializerCompiler);

server.withTypeProvider<ZodTypeProvider>().route({
  method: "POST",
  url: "/scrape",
  schema: {
    body: scrapeSchema,
  },
  handler: scrapeHandler,
});

server.listen({ host, port }, (err, address) => {
  if (err) {
    console.error(err);
    process.exit(1);
  }
  console.log(`Server listening at ${address}`);
});
