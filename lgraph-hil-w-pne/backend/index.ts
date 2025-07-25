import fastify from "fastify";
import { env } from "../env.js";
import { serializerCompiler, validatorCompiler, ZodTypeProvider } from "fastify-type-provider-zod";
import { chatHandler, chatSchema } from "./src/chat-agent/index.js";

const port = parseInt(env.PORT)
const host = `localhost`

const server = fastify({
  logger: {
    transport: {
      target: 'pino-pretty',
      options: {
        translateTime: 'HH:MM:ss Z',
        ignore: 'pid,hostname',
      },
    },
  }
});

server.setValidatorCompiler(validatorCompiler);
server.setSerializerCompiler(serializerCompiler);

server.withTypeProvider<ZodTypeProvider>().route({
  method: "POST",
  url: '/chat',
  schema: {
    body: chatSchema,
  },
  handler: chatHandler,
});

server.listen({ host, port }, (err, address) => {
  if (err) {
    console.error(err);
    process.exit(1);
  }
  console.log(`Server listening at ${address}`);
});
