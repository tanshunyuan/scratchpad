import { FastifyReply, FastifyRequest } from "fastify";
import z from "zod";

export const chatSchema = z.object({
  threadId: z.string().optional()
});
export const chatHandler = async (
  req: FastifyRequest<{ Body: z.infer<typeof chatSchema> }>,
  res: FastifyReply,
) => { }