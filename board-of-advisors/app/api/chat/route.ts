import {
  safeValidateUIMessages,
  createUIMessageStream,
  createUIMessageStreamResponse,
  UIMessage,
} from "ai";
import { StateGraph, END, Annotation, START } from "@langchain/langgraph";
import { FakeListChatModel } from "@langchain/core/utils/testing";
import {
  HumanMessage,
  AIMessage,
  BaseMessage,
  SystemMessage,
} from "@langchain/core/messages";
import z from "zod";
import { ChatOpenAI } from "@langchain/openai";

/**
 * Processes a raw conversation array and returns a formatted string
 * containing only user and assistant message exchanges.
 */
function formatConversation(messages: UIMessage[]) {
  const lines = [];

  for (const msg of messages) {
    // Skip messages without parts or with empty parts
    if (!msg.parts || !Array.isArray(msg.parts)) continue;

    // Extract text content from parts (ignore non-text parts like data-status)
    const textParts = msg.parts
      .filter((part) => part.type === "text")
      .map((part) => part.text.trim())
      .filter((text) => text.length > 0);

    if (textParts.length === 0) continue;

    const content = textParts.join(" ").replace(/\s+/g, " "); // normalize whitespace

    if (msg.role === "user") {
      lines.push(`User: ${content}`);
    } else if (msg.role === "assistant") {
      lines.push(`Assistant: ${content}`);
    }
  }

  return lines.join("\n");
}

const requestSchema = z.object({
  messages: z.custom<UIMessage[]>(async (val) => {
    const result = await safeValidateUIMessages({ messages: val });
    if (!result.success) {
      throw new Error(result.error.message);
    }
    return result.data;
  }),
  advisors: z
    .array(
      z.object({
        id: z.string(),
        name: z.string(),
        expertise: z.string(),
      }),
    )
    .min(1),
});

interface Advisor {
  id: string;
  name: string;
  expertise: string;
}

const StateAnnotation = Annotation.Root({
  messages: Annotation<BaseMessage[]>({
    reducer: (left: BaseMessage[], right: BaseMessage | BaseMessage[]) => {
      if (Array.isArray(right)) {
        return left.concat(right);
      }
      return left.concat([right]);
    },
    default: () => [],
  }),
  userQuery: Annotation<string>(),
  isComplex: Annotation<boolean>({
    reducer: (state, update) => update ?? state,
    default: () => false,
  }),
  chosenAdvisors: Annotation<string[]>({
    reducer: (state, update) => update ?? state,
    default: () => [],
  }),
  advisors: Annotation<Advisor[]>,
});

export async function POST(req: Request) {
  console.log("at POST /api/chat");
  try {
    const rawBody = await req.json();
    const body = await requestSchema.parseAsync(rawBody);

    // Get the latest user message
    const userQuery =
      body.messages[body.messages.length - 1]?.parts?.find(
        (p: any) => p.type === "text",
      )?.text || "";

    console.log("messages ==> ", JSON.stringify(body.messages));
    console.log("userQuery ==> ", userQuery);

    const stream = createUIMessageStream({
      execute: async ({ writer }) => {
        writer.write({
          type: "data-status",
          data: { message: "Analyzing query complexity...", stage: "scout" },
          // transient: true,
        });

        const model = new ChatOpenAI({
          model: "gpt-4.1-mini",
          temperature: 1,
          streaming: true,
        });

        // Step 1: Complexity Scout
        async function complexityScout(state: typeof StateAnnotation.State) {
          console.log("at complexityScout");

          const ComplexityScoutOutputSchema = z.object({
            decision: z.enum(["COMPLEX", "NOT_COMPLEX"]),
            clarifying_question: z.string().nullable(), // must be present, but can be null
          });

          const COMPLEXITY_SCOUT_SYSTEM_MSG = new SystemMessage(
            `
            You are a Complexity Scout. Your job is to decide whether the user's request—**in the full context of the conversation history**—is ready for expert advisor input.

            Follow these rules:

            1. **Count how many clarifying questions the assistant has already asked.**
               - If **3 or more** have been asked, the request is automatically **COMPLEX**.
            2. Otherwise, mark as **COMPLEX** if:
               - The user has clearly specified the topic, scope, depth, and format, AND
               - The request involves strategic thinking, tradeoffs, multiple perspectives, or expert judgment.
            3. Mark as **NOT_COMPLEX** **only** if the request is still ambiguous or missing key details.
               - In that case, formulate **one brief, natural clarifying question** to resolve the main remaining uncertainty.

            Do not worry about response formatting—the system will handle that. Just focus on making the right decision.
            `,
          );

          const COMPLEXITY_SCOUT_HUMAN_MSG = new HumanMessage(`
            Current user request: "${userQuery}"

            Full conversation history:
            ${formatConversation(body.messages)}
          `);

          console.log(
            "COMPLEXITY_SCOUT_HUMAN_MSG ==> ",
            COMPLEXITY_SCOUT_HUMAN_MSG,
          );

          const structuredModel = model.withStructuredOutput(
            ComplexityScoutOutputSchema,
            {
              name: "ComplexityScoutResponse",
              strict: true,
            },
          );

          const response = await structuredModel.invoke([
            COMPLEXITY_SCOUT_SYSTEM_MSG,
            COMPLEXITY_SCOUT_HUMAN_MSG,
          ]);
          const isComplex = response.decision === "COMPLEX";

          if (!isComplex && response.clarifying_question !== null) {
            const textId = "clarification-response";
            writer.write({ type: "text-start", id: textId });

            const words = response.clarifying_question.split(" ");
            for (let i = 0; i < words.length; i++) {
              writer.write({
                type: "text-delta",
                id: textId,
                delta: words[i] + (i < words.length - 1 ? " " : ""),
              });
              await new Promise((resolve) => setTimeout(resolve, 30));
            }

            writer.write({ type: "text-end", id: textId });
          }

          return {
            ...state,
            isComplex,
            messages: [...state.messages, response],
          };
        }

        // Step 2: Supervisor
        async function supervisor(state: typeof StateAnnotation.State): Promise<Partial<typeof StateAnnotation.State>> {
          console.log("at supervisor");

          if (!state.isComplex) {
            return { chosenAdvisors: [] };
          }

          writer.write({
            type: "data-status",
            data: { message: "Selecting best advisor(s)...", stage: "supervisor" },
            // transient: true,
          });

          const advisorList = state.advisors
            .map((a: any) => `- ${a.name}: ${a.expertise}`)
            .join("\n");

          const SUPERVISOR_PROMPT = new HumanMessage(`
            Given this request: "${state.userQuery}"

            Available advisors:
            ${advisorList}

            Which advisors is BEST suited to answer this? Respond with ONLY their names separated by commas, nothing else.
            `);
          console.log("supervisor.SUPERVISOR_PROMPT ==> ", SUPERVISOR_PROMPT);

          const response = await model.invoke([SUPERVISOR_PROMPT]);
          console.log("supervisor.response ==> ", response);

          const chosenNames = response.content.toString().trim();

          const chosenAdvisors = chosenNames
            .split(",")
            .map((name) => name.trim())
            .filter((name) => name.length > 0);

          console.log("chosenAdvisors ==> ", chosenAdvisors);

          for (const advisorName of chosenAdvisors) {
            const selectedAdvisor = state.advisors.find(
              (a: any) => a.name.toLowerCase() === advisorName.toLowerCase(),
            );

            if (selectedAdvisor) {
              writer.write({
                type: "data-advisor",
                id: `advisor-${selectedAdvisor.id}`,
                data: {
                  name: selectedAdvisor.name,
                  expertise: selectedAdvisor.expertise,
                },
              });
            }
          }


          return {
            chosenAdvisors,
            messages: [response],
          };
        }

        // Step 3: Chosen Advisor
        async function advisorResponse(state: typeof StateAnnotation.State) {
          console.log("at advisorResponse");

          if (!state.chosenAdvisors || state.chosenAdvisors.length === 0) {
            const textId = "error-response";
            writer.write({ type: "text-start", id: textId });
            writer.write({
              type: "text-delta",
              id: textId,
              delta:
                "I encountered an issue selecting advisors. Please try rephrasing your question.",
            });
            writer.write({ type: "text-end", id: textId });

            return {
              messages: [
                new AIMessage(
                  "I encountered an issue selecting advisors. Please try rephrasing your question.",
                ),
              ],
            };
          }

          const responses: BaseMessage[] = [];

          for (let i = 0; i < state.chosenAdvisors.length; i++) {
            const advisorName = state.chosenAdvisors[i];
            const advisor = state.advisors.find(
              (a: any) => a.name.toLowerCase() === advisorName.toLowerCase(),
            );
            if (!advisor) {
              console.log(`Advisor ${advisorName} not found, skipping...`);
              continue;
            }

            writer.write({
              type: "data-status",
              data: {
                message: `${advisor.name} is formulating response...`,
                stage: "advisor",
                advisorIndex: i + 1,
                totalAdvisors: state.chosenAdvisors.length,
              },
              // transient: true,
            });

            const textId = `advisor-response-${advisor.id}`;

            // Write advisor header
            writer.write({
              type: "data-advisor-header",
              id: `header-${advisor.id}`,
              data: {
                name: advisor.name,
                expertise: advisor.expertise,
                index: i + 1,
                total: state.chosenAdvisors.length,
              },
            });
            const ADVISOR_RESPONSE_SYSTEM_MSG = new SystemMessage(`
            You are ${advisor.name}, a recognized expert in ${advisor.expertise}.

            The user has engaged in a conversation to clarify their request.
            **You must base your response entirely on the final, refined intent expressed in the full conversation history.**

            Do NOT:
            - Ask for further clarification
            - Repeat questions already answered
            - Treat the current query in isolation

            Instead, DO:
            1. Synthesize all prior context to understand the user’s precise need
            2. Address the request with depth, using your expert judgment
            3. Include:
               - Key strategic considerations
               - Potential risks and tradeoffs
               - A clear, actionable recommendation with reasoning

            Respond authoritatively and concisely in the voice of ${advisor.name}, as if delivering final expert advice to a client who has already specified their requirements.
            `);

            const ADVISOR_RESPONSE_HUMAN_MSG = new HumanMessage(`
            Current user question: "${state.userQuery}"

            Full conversation history:
            ${formatConversation(body.messages)}
            `);

            console.log(
              `ADVISOR_RESPONSE_HUMAN_MSG ==> `,
              ADVISOR_RESPONSE_HUMAN_MSG,
            );
            const response = await model.invoke([
              ADVISOR_RESPONSE_SYSTEM_MSG,
              ADVISOR_RESPONSE_HUMAN_MSG,
            ]);
            const responseText = response.content.toString();
            console.log(`advisorResponse[${i}].response ==> `, response);
            writer.write({
              type: "text-start",
              id: textId,
            });
            const words = responseText.split(" ");
            for (let j = 0; j < words.length; j++) {
              writer.write({
                type: "text-delta",
                id: textId,
                delta: words[j] + (j < words.length - 1 ? " " : ""),
              });
              await new Promise((resolve) => setTimeout(resolve, 30));
            }

            writer.write({ type: "text-end", id: textId });

            responses.push(response);

            // Add a separator if not the last advisor
            if (i < state.chosenAdvisors.length - 1) {
              writer.write({
                type: "data-separator",
                id: `separator-${i}`,
                data: { type: "advisor-divider" },
              });
            }
          }

          return {
            messages: responses
          };
        }

        // Route logic
        function routeAfterComplexity(state: typeof StateAnnotation.State) {
          console.log("at routeAfterComplexity");
          return state.isComplex ? "supervisor" : "ask_user";
        }

        // Build the graph
        const workflow = new StateGraph(StateAnnotation);

        workflow
          .addNode("complexity_scout", complexityScout)
          .addNode("supervisor", supervisor)
          .addNode("advisor", advisorResponse)
          .addEdge(START, "complexity_scout")
          .addConditionalEdges("complexity_scout", routeAfterComplexity, {
            supervisor: "supervisor",
            ask_user: END,
            // ask_user: "advisor",
          })
          .addEdge("supervisor", "advisor")
          .addEdge("advisor", END);

        // Compile and run
        const app = workflow.compile();

        await app.invoke({
          userQuery,
          advisors: body.advisors,
        });

        writer.write({
          type: "data-status",
          data: { message: "Complete", stage: "done" },
          // transient: true,
        });
      },
      onError: (error) => {
        throw error;
      },
    });

    return createUIMessageStreamResponse({ stream });
  } catch (error) {
    console.error("Error in advisor-chat route:", error);
    return new Response(
      JSON.stringify({
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
}
