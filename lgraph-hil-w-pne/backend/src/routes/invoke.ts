import { FastifyReply, FastifyRequest } from "fastify";
import z from "zod";
import { nanoid } from "nanoid";
import { Command, LangGraphRunnableConfig } from "@langchain/langgraph";
import isEmpty from "lodash-es/isEmpty.js";
import { RunnableConfig } from "@langchain/core/runnables";
import { langfuseHandler } from "../utils/langfuse.js";
import { chatAgent } from "../chat-agent/graph.js";

export const invokeChatSchema = z.object({
  message: z.string(),
});
export const invokeChatHandler = async (
  req: FastifyRequest<{ Body: z.infer<typeof invokeChatSchema> }>,
  res: FastifyReply,
) => {
  try {
    const { message } = req.body;
    const generatedThreadId = nanoid();
    const config: LangGraphRunnableConfig = {
      configurable: {
        thread_id: generatedThreadId,
      },
      callbacks: [langfuseHandler]
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
  } catch (err) {
    console.error(err);
    return res.code(500).send({
      error: err.message,
    });
  }
};

export const invokeChatResumeSchema = z
  .object({
    threadId: z.string(),
    // should validate that message is needed if type === feedback
    message: z.string().optional(),
    type: z.enum(["accept", "feedback"]),
  })
export const invokeChatResumeHandler = async (
  req: FastifyRequest<{ Body: z.infer<typeof invokeChatResumeSchema> }>,
  res: FastifyReply,
) => {
  try {
    const { threadId, message, type } = req.body;
    req.log.debug(`resuming a conversation: ${threadId}`);
    req.log.debug(`the body ${JSON.stringify(req.body, null, 2)}`)
    const config: LangGraphRunnableConfig = {
      recursionLimit: 35,
      configurable: {
        thread_id: threadId,
      },
      callbacks: [langfuseHandler]
    };
    console.log('resume config ==> ', JSON.stringify(config, null, 2))
    const state = await chatAgent.getState(config);
    if (isEmpty(state.values)) {
      return res.code(400).send({
        error: `Chat thread not found. threadId: ${threadId}`,
      });
    }
    let resumeCommand;
    if (type === 'accept') {
      resumeCommand = new Command({
        resume: {
          action: {
            type: 'accept',
          },
        },
      });
    } else if (type === 'feedback' && !isEmpty(message)) {
      resumeCommand = new Command({
        resume: {
          action: {
            type: 'feedback',
            feedback: message
          },
        },
      });
    } else {
      return res.code(400).send({
        error: `Either the type passed in is wrong or message is empty when sending in a feedback`
      })
    }
    const response = await chatAgent.invoke(resumeCommand, config);
    const resumeState = await chatAgent.getState(config)

    if (resumeState.next.includes("human_review")) {
      const task = resumeState.tasks[0];
      const interrupt = task.interrupts[0];
      const interruptValue = interrupt.value;
      return res.code(200).send({
        threadId,
        response: interruptValue,
        final: false
      });
    }
    return res.code(200).send({
      threadId,
      response: response.response,
      final: true
    });
  } catch (err) {
    console.error(err);
    return res.code(500).send({
      error: err.message,
    });
  }
};
