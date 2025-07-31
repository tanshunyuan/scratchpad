import { createDataStreamResponse } from "ai";
import { FastifyReply, FastifyRequest } from "fastify";
import { isArray, isEmpty } from "lodash-es";
import { nanoid } from "nanoid";
import z from "zod";
import { chatAgent } from "../chat-agent/graph.js";
import { Command } from "@langchain/langgraph";
import { IterableReadableStream } from "@langchain/core/utils/stream";
import { StreamEvent } from "@langchain/core/tracers/log_stream";

export const streamNewChatSchema = z.object({
  threadId: z.string().optional(),
  message: z.string().optional(),
  type: z.enum(['accept', 'feedback']).optional(),
}).superRefine((data, ctx) => {
  if (!data.threadId) {
    // threadId is empty, message should be required
    if (!data.message) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['message'],
        message: '`message` is required when `threadId` is empty',
      });
    }
  } else {
    // threadId is not empty, type should be required
    if (!data.type) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['type'],
        message: '`type` is required when `threadId` is provided',
      });
    }

    // If type is feedback, message should be required
    if (data.type === 'feedback' && !data.message) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['message'],
        message: '`message` is required when `type` is feedback',
      });
    }
  }
});


export const streamNewChatHandler = async (
  req: FastifyRequest<{ Body: z.infer<typeof streamNewChatSchema> }>,
  res: FastifyReply,
) => {
  try {
    const { threadId, message, type } = req.body;

    const sseResponse = createDataStreamResponse({
      status: 200,
      statusText: "OK",
      execute: async (dataStream) => {
        let agentOutput: IterableReadableStream<StreamEvent>;
        let currentThreadId: string

        if (isEmpty(threadId)) {
          currentThreadId = nanoid();
          req.log.debug(`starting a new conversation: ${currentThreadId}`);

          agentOutput = await chatAgent.streamEvents({
            input: message
          }, {
            configurable: {
              thread_id: currentThreadId,
            },
            version: "v2",
            // callbacks: [langfuseHandler]
          })

        } else {
          currentThreadId = threadId!
          req.log.debug(`resuming a conversation: ${currentThreadId}`);
          req.log.debug(`the body ${JSON.stringify(req.body, null, 2)}`)

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

          agentOutput = await chatAgent.streamEvents(resumeCommand, {
            configurable: {
              thread_id: currentThreadId,
            },
            version: "v2",
            // callbacks: [langfuseHandler]
          })
        }

        for await (const events of agentOutput) {
          const { data, event, name, run_id, metadata } = events

          if (event === 'on_chain_stream') {
            const { chunk } = data
            const hasInterrupt = Object.hasOwn(chunk, '__interrupt__') && isArray(chunk['__interrupt__']) && !isEmpty(chunk['__interrupt__'])
            if (hasInterrupt) {
              const interrupt = chunk['__interrupt__'][0]
              const value = interrupt.value as {
                question: string,
                plan: string[]
              }
              dataStream.writeData({
                response: value,
                final: false
              })
            }

            const hasReplan = Object.hasOwn(chunk, 'replan') && !isEmpty(chunk['replan'])
            if (hasReplan) {
              const hasResponse = Object.hasOwn(chunk['replan'], 'response') && !isEmpty(chunk['replan']['response'])
              if (hasResponse) {
                dataStream.writeData({
                  final: true,
                  response: chunk['replan']['response']
                })
              }
            }
          }
        }

        dataStream.writeData({
          threadId: currentThreadId
        })
      },
      onError: (error) => {
        console.error(error);
        return error as string
      }
    })

    return res.code(sseResponse.status).send(sseResponse)
  } catch (error) {
    console.error(err);
    return res.code(500).send({
      error: err.message,
    });
  }
}