import fastify from "fastify";
import { env } from "../env.js";
import { serializerCompiler, validatorCompiler } from "fastify-type-provider-zod";

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

// server.withTypeProvider<ZodTypeProvider>().route({
//   method: "POST",
//   url: '/chat-agent',
//   schema: {
//     body: chatAgentSchema,
//   },
//   handler: chatAgentHandler,
// });

server.listen({ host, port }, (err, address) => {
  if (err) {
    console.error(err);
    process.exit(1);
  }
  console.log(`Server listening at ${address}`);
});
