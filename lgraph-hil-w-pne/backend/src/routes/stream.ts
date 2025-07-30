import { LangGraphRunnableConfig } from "@langchain/langgraph";
import { FastifyReply, FastifyRequest } from "fastify";
import { nanoid } from "nanoid";
import z from "zod";
import { langfuseHandler } from "../utils/langfuse.js";
import { chatAgent } from "../chat-agent/graph.js";
import { createDataStreamResponse } from 'ai'
import encodeurl from 'encodeurl';

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
          encoding: "text/event-stream"
          // callbacks: [langfuseHandler]
        })

        for await (const events of agentOutput) {
          dataStream.writeData(JSON.stringify(events, null, 2))
        }
      },
      onError: (error) => {
        console.error(error);
        return error
      }
    })

    // const headers = Object.fromEntries(
    //   Array.from(sseResponse.headers.entries()).map(([k, v]) => [k, encodeurl(v)])
    // );
    // console.log(headers)
    // console.log(sseResponse.headers)
    // return res.code(sseResponse.status)
    //   // .headers({...headers})
    //   .send({
    //     threadId: generatedThreadId,
    //     response: sseResponse
    //   })

    return res.code(200).send({
      threadId: generatedThreadId,
      response: sseResponse
    })

    // const state = await chatAgent.getState(config);

    // if (state.next.includes("human_review")) {
    //   const task = state.tasks[0];
    //   const interrupt = task.interrupts[0];
    //   const interruptValue = interrupt.value;
    //   return res.code(200).send({
    //     threadId: generatedThreadId,
    //     response: interruptValue,
    //   });
    // }

    // return res.code(200).send({
    //   threadId: generatedThreadId,
    //   response: response.response,
    // });
  } catch (err) {
    console.error(err);
    return res.code(500).send({
      error: err.message,
    });
  }
};
