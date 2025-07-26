import { FastifyReply, FastifyRequest } from "fastify";
import z from "zod";
import { nanoid } from "nanoid";
import { chatAgent, chatAgentWorkflow } from "./graph.js";
import { Command, MemorySaver, PregelOptions } from "@langchain/langgraph";
import isEmpty from "lodash/isEmpty.js";

export const chatSchema = z.object({
  threadId: z.string().optional(),
  message: z.string(),
  type: z.enum(["accept", "feedback"]).optional(),
});
export const chatHandler = async (
  req: FastifyRequest<{ Body: z.infer<typeof chatSchema> }>,
  res: FastifyReply,
) => {
  try {
    const { threadId, message, type } = req.body;
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
      const config = {
        debug: true,
        configurable: {
          thread_id: threadId,
        },
      };
      const state = await chatAgent.getState(config);
      console.log(JSON.stringify(state, null, 2));
      if (isEmpty(state.values)) {
        return res.code(400).send({
          error: `Chat thread not found. threadId: ${threadId}`,
        });
      }
      const resumeCommand = new Command({
        resume: {
          action: {
            type: type,
            feedback: message,
          },
        },
      });
      const response = await chatAgent.invoke(resumeCommand, config);
      return res.code(200).send({
        threadId,
        response: response.response,
      });
    }
  } catch (err) {
    console.error(err);
    return res.code(500).send({
      error: err.message,
    });
  }
};
