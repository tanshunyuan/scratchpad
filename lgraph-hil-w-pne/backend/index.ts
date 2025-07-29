import fastify from "fastify";
import { env } from "./env.js";
import {
  serializerCompiler,
  validatorCompiler,
  ZodTypeProvider,
} from "fastify-type-provider-zod";
import {
  chatHandler,
  chatResumeHandler,
  chatResumeSchema,
  chatSchema,
} from "./src/chat-agent/index.js";
import cors from '@fastify/cors'

const port = parseInt(env.PORT);
const host = `localhost`;

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
    origin: 'http://localhost:3000',
    methods: ['GET', 'POST', 'PUT', 'DELETE']
  })

server.setValidatorCompiler(validatorCompiler);
server.setSerializerCompiler(serializerCompiler);

server.withTypeProvider<ZodTypeProvider>().route({
  method: "POST",
  url: "/invoke/chat",
  schema: {
    body: chatSchema,
  },
  handler: chatHandler,
});

server.withTypeProvider<ZodTypeProvider>().route({
  method: "POST",
  url: "/invoke/chat/resume",
  schema: {
    body: chatResumeSchema,
  },
  handler: chatResumeHandler,
});

server.listen({ host, port }, (err, address) => {
  if (err) {
    console.error(err);
    process.exit(1);
  }
  console.log(`Server listening at ${address}`);
});
