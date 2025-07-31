import fastify from "fastify";
import { env } from "./env.js";
import {
  serializerCompiler,
  validatorCompiler,
  ZodTypeProvider,
} from "fastify-type-provider-zod";
import {
  invokeChatHandler,
  invokeChatResumeHandler,
  invokeChatResumeSchema,
  invokeChatSchema,
} from "./src/routes/invoke.js";
import cors from '@fastify/cors'
import { streamChatHandler, streamChatResumeHandler, streamChatResumeSchema, streamChatSchema } from "./src/routes/stream.js";
import { streamNewChatHandler, streamNewChatSchema } from "./src/routes/stream-new.js";

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
    body: invokeChatSchema,
  },
  handler: invokeChatHandler,
});

server.withTypeProvider<ZodTypeProvider>().route({
  method: "POST",
  url: "/invoke/chat/resume",
  schema: {
    body: invokeChatResumeSchema,
  },
  handler: invokeChatResumeHandler,
});

server.withTypeProvider<ZodTypeProvider>().route({
  method: "POST",
  url: "/stream/chat",
  schema: {
    body: streamChatSchema,
  },
  handler: streamChatHandler,
});

server.withTypeProvider<ZodTypeProvider>().route({
  method: "POST",
  url: "/stream/chat/resume",
  schema: {
    body: streamChatResumeSchema,
  },
  handler: streamChatResumeHandler,
});

server.withTypeProvider<ZodTypeProvider>().route({
  method: "POST",
  url: "/stream/chat/new",
  schema: {
    body: streamNewChatSchema,
  },
  handler: streamNewChatHandler,
});

server.listen({ host, port }, (err, address) => {
  if (err) {
    console.error(err);
    process.exit(1);
  }
  console.log(`Server listening at ${address}`);
});
