import { FastifyReply, FastifyRequest } from "fastify";
import z from "zod";
import { nanoid } from "nanoid";
import { chatAgent } from "./graph.js";
import { Command, MemorySaver, PregelOptions } from "@langchain/langgraph";
import isEmpty from "lodash/isEmpty.js";

export const chatSchema = z.object({
  message: z.string(),
});
export const chatHandler = async (
  req: FastifyRequest<{ Body: z.infer<typeof chatSchema> }>,
  res: FastifyReply,
) => {
  try {
    const { message } = req.body;
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
  } catch (err) {
    console.error(err);
    return res.code(500).send({
      error: err.message,
    });
  }
};

export const chatResumeSchema = z
  .object({
    threadId: z.string(),
    // should validate that message is needed if type === feedback
    message: z.string().optional(),
    type: z.enum(["accept", "feedback"]),
  })
export const chatResumeHandler = async (
  req: FastifyRequest<{ Body: z.infer<typeof chatResumeSchema> }>,
  res: FastifyReply,
) => {
  try {
    const { threadId, message, type } = req.body;
    req.log.debug(`resuming a conversation: ${threadId}`);
    const config = {
      recursionLimit: 25,
      debug: true,
      configurable: {
        thread_id: threadId,
      },
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
    console.log('response ==> ', JSON.stringify(response, null, 2))
    return res.code(200).send({
      threadId,
      response: response.response,
    });
    // return res.code(200).send({
    //   threadId
    // })
  } catch (err) {
    console.error(err);
    return res.code(500).send({
      error: err.message,
    });
  }
};
