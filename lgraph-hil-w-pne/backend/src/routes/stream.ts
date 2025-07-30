import { Command, LangGraphRunnableConfig } from "@langchain/langgraph";
import { FastifyReply, FastifyRequest } from "fastify";
import { nanoid } from "nanoid";
import z from "zod";
import { langfuseHandler } from "../utils/langfuse.js";
import { chatAgent } from "../chat-agent/graph.js";
import { createDataStreamResponse } from 'ai'
import encodeurl from 'encodeurl';
import { hasIn, isArray, isEmpty } from "lodash-es";

export const streamChatSchema = z.object({
  message: z.string(),
});

export const streamChatHandler = async (
  req: FastifyRequest<{ Body: z.infer<typeof streamChatSchema> }>,
  res: FastifyReply,
) => {
  try {
    const { message } = req.body;
    const generatedThreadId = nanoid();

    req.log.debug(`starting a new conversation: ${generatedThreadId}`);

    const sseResponse = createDataStreamResponse({
      status: 200,
      statusText: "OK",
      execute: async (dataStream) => {
        const agentOutput = await chatAgent.streamEvents({
          input: message
        }, {
          configurable: {
            thread_id: generatedThreadId,
          },
          version: "v2",
          // callbacks: [langfuseHandler]
        })

        dataStream.writeData({
          threadId: generatedThreadId
        })

        for await (const events of agentOutput) {
          const { data, event, name, run_id, metadata } = events

          if (event === 'on_chain_stream') {
            const { chunk } = data
            const hasInterrupt = Object.hasOwn(chunk, '__interrupt__') && isArray(chunk['__interrupt__']) && !isEmpty(chunk['__interrupt__'])
            if (!hasInterrupt) continue

            const interrupt = chunk['__interrupt__'][0]
            const value = interrupt.value as {
              question: string,
              plan: string[]
            }
            dataStream.writeData({
              response: value
            })
          }
        }
      },
      onError: (error) => {
        console.error(error);
        return error
      }
    })

    return res.code(200).send(sseResponse)

  } catch (err) {
    console.error(err);
    return res.code(500).send({
      error: err.message,
    });
  }
};

export const streamChatResumeSchema = z
  .object({
    threadId: z.string(),
    // should validate that message is needed if type === feedback
    message: z.string().optional(),
    type: z.enum(["accept", "feedback"]),
  })
export const streamChatResumeHandler = async (
  req: FastifyRequest<{ Body: z.infer<typeof streamChatResumeSchema> }>,
  res: FastifyReply,
) => {
  try {
    const { threadId, message, type } = req.body;
    req.log.debug(`resuming a conversation: ${threadId}`);
    req.log.debug(`the body ${JSON.stringify(req.body, null, 2)}`)

    // for some reason this doesn't work 
    // const state = await chatAgent.getState({
    //   recursionLimit: 35,
    //   configurable: {
    //     threadId: threadId
    //   },
    //   //   callbacks: [langfuseHandler]
    // });
    // if (isEmpty(state.values)) {
    //   return res.code(400).send({
    //     error: `Chat thread not found. threadId: ${threadId}`,
    //   });
    // }

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

    const sseResponse = createDataStreamResponse({
      status: 200,
      statusText: "OK",
      execute: async (dataStream) => {
        const agentOutput = await chatAgent.streamEvents(resumeCommand, {
          configurable: {
            thread_id: threadId,
          },
          version: "v2",
          // callbacks: [langfuseHandler]
        })

        dataStream.writeData({
          threadId: threadId
        })

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
      },
      onError: (error) => {
        console.error(error);
        return error
      }
    })

    return res.code(200).send(sseResponse)
  } catch (err) {
    console.error(err);
    return res.code(500).send({
      error: err.message,
    });
  }
};