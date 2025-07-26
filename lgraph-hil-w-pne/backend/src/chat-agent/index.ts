import { FastifyReply, FastifyRequest } from "fastify";
import z from "zod";
import { nanoid } from "nanoid";
import { chatAgentWorkflow } from "./graph.js";
import { MemorySaver, PregelOptions } from "@langchain/langgraph";

export const chatSchema = z.object({
  threadId: z.string().optional(),
  message: z.string(),
  // data: z
  //   .object({
  //     type: z.enum(["accept", "feedback"]),
  //     feedback: z.string().optional(),
  //   })
  //   .optional()
  //   .superRefine((data, ctx) => {
  //     if (data?.type === "feedback") {
  //       ctx.addIssue({
  //         code: "custom",
  //         message: "The `feedback` attribute is required if type is feedback",
  //         path: ["feedback"],
  //       });
  //     }
  //   }),
});
export const chatHandler = async (
  req: FastifyRequest<{ Body: z.infer<typeof chatSchema> }>,
  res: FastifyReply,
) => {
  try {
    const { threadId, message } = req.body;
    const checkpointer = new MemorySaver();
    const chatAgent = chatAgentWorkflow.compile({
      checkpointer,
    });
    if (!threadId) {
      const generatedThreadId = nanoid();
      const config = {
        debug: true,
        configurable: {
          thread_id: generatedThreadId,
        },
      };

      req.log.debug(`starting a new conversation: ${generatedThreadId}`);
      const response = await chatAgent.invoke(
        {
          input: message,
        },
        config,
      );

      const state = await chatAgent.getState(config);

      if (state.next.includes("human_review")) {
        const task = state.tasks[0];
        const interrupt = task.interrupts[0];
        const interruptValue = interrupt.value;
        return res.code(200).send({
          threadId: generatedThreadId,
          response: interruptValue,
        });
      }

      return res.code(200).send({
        threadId: generatedThreadId,
        response: response.response,
      });
    } else {
      req.log.debug(`resuming a conversation: ${threadId}`);
    }
  } catch (err) {
    console.error(err);
    return res.code(500).send({
      error: err.message,
    });
  }
};
