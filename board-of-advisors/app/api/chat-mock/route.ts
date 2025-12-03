import {
  safeValidateUIMessages,
  createUIMessageStream,
  createUIMessageStreamResponse,
  UIMessage,
} from "ai";
import { StateGraph, END, Annotation, START } from "@langchain/langgraph";
import { FakeListChatModel } from "@langchain/core/utils/testing";
import { HumanMessage, AIMessage, BaseMessage } from "@langchain/core/messages";
import z from "zod";

interface GraphState {
  messages: BaseMessage[];
  userQuery: string;
  isComplex: boolean;
  chosenAdvisor: string | null;
  advisors: any[];
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

export async function POST(req: Request) {
  console.log("at POST /api/chat-mock");
  try {
    const rawBody = await req.json();
    const body = await requestSchema.parseAsync(rawBody);

    const { messages, advisors } = body;

    console.log("body ==> ", body);

    // Get the latest user message
    const userQuery =
      messages[messages.length - 1]?.parts?.find((p: any) => p.type === "text")
        ?.text || "";

    console.log("userQuery ==> ", userQuery);

    const stream = createUIMessageStream({
      execute: async ({ writer }) => {
        writer.write({
          type: "data-status",
          data: { message: "Analyzing query complexity...", stage: "scout" },
          transient: true,
        });

        // Determine mock responses based on query complexity
        const isComplexQuery =
          userQuery.length > 50 ||
          (userQuery.includes("?") &&
            (userQuery.includes("should") ||
              userQuery.includes("recommend") ||
              userQuery.includes("strategy")));

        let mockResponses: string[];

        if (isComplexQuery) {
          // Complex path: complexity scout → supervisor → advisor
          const selectedAdvisor = advisors[0]; // Pick first advisor for simplicity
          mockResponses = [
            "COMPLEX", // Complexity scout says it's complex
            selectedAdvisor.name, // Supervisor picks an advisor
            `As ${selectedAdvisor.name}, an expert in ${selectedAdvisor.expertise}, I'll provide my perspective on your question.

            Based on my analysis of "${userQuery.substring(0, 100)}${userQuery.length > 100 ? "..." : ""}", here are my key recommendations:

            1. **Strategic Considerations**: This requires a balanced approach that considers both short-term gains and long-term sustainability. The market dynamics suggest we should prioritize user value over rapid growth.

            2. **Risk Assessment**: The main risks include market saturation, competitive pressure, and potential regulatory changes. I recommend building in flexibility to pivot as needed.

            3. **My Recommendation**: I suggest a phased approach where we test core assumptions in small pilots before full commitment. This de-risks the decision while allowing us to learn and adapt.

            The key success factors will be clear metrics, stakeholder alignment, and maintaining agility throughout execution.`,
          ];
        } else {
          // Not complex path: complexity scout asks for more details
          mockResponses = [
            `NOT_COMPLEX - To provide better guidance, could you elaborate on:
            - What specific aspects are you most concerned about?
            - What constraints or requirements do you have?
            - What's your timeline for making this decision?

            This will help me route you to the right advisor with more targeted advice.`,
            "", // Won't reach supervisor
            "", // Won't reach advisor
          ];
        }

        // Create fake model with predefined responses
        const fakeModel = new FakeListChatModel({
          responses: mockResponses,
          sleep: 100, // Simulate API delay
        });

        // Step 1: Complexity Scout
        async function complexityScout(state: GraphState) {
          const prompt = `Analyze this user request: "${state.userQuery}"

            Is this request complex enough to warrant advisor input? A complex request:
            - Requires strategic thinking or tradeoffs
            - Involves multiple perspectives
            - Has significant implications
            - Needs expert judgment

            Respond with ONLY "COMPLEX" or "NOT_COMPLEX" followed by a brief clarifying question if not complex.`;

          const response = await fakeModel.invoke([new HumanMessage(prompt)]);
          const content = response.content.toString();

          return {
            ...state,
            isComplex:
              content.includes("COMPLEX") && !content.includes("NOT_COMPLEX"),
            messages: [...state.messages, response],
          };
        }

        // Step 2: Supervisor
        async function supervisor(state: GraphState) {
          if (!state.isComplex) {
            return { ...state, chosenAdvisor: null };
          }

          writer.write({
            type: "data-status",
            data: { message: "Selecting best advisor...", stage: "supervisor" },
            transient: true,
          });

          const advisorList = state.advisors
            .map((a: any) => `- ${a.name}: ${a.expertise}`)
            .join("\n");

          const prompt = `Given this request: "${state.userQuery}"

            Available advisors:
            ${advisorList}

            Which advisor is BEST suited to answer this? Respond with ONLY the advisor's name, nothing else.`;

          const response = await fakeModel.invoke([new HumanMessage(prompt)]);
          const chosenName = response.content.toString().trim();

          const selectedAdvisor = state.advisors.find(
            (a: any) => a.name.toLowerCase() === chosenName.toLowerCase(),
          );

          if (selectedAdvisor) {
            writer.write({
              type: "data-advisor",
              id: "selected-advisor",
              data: {
                name: selectedAdvisor.name,
                expertise: selectedAdvisor.expertise,
              },
            });
          }

          return {
            ...state,
            chosenAdvisor: chosenName,
            messages: [...state.messages, response],
          };
        }

        // Step 3: Chosen Advisor
        async function advisorResponse(state: GraphState) {
          const textId = "advisor-response";
          if (!state.chosenAdvisor) {
            // Write the clarification message
            const clarificationMsg = state.messages[state.messages.length - 1];
            const clarificationText = clarificationMsg.content.toString();

            // Start text stream
            writer.write({
              type: "text-start",
              id: textId,
            });

            // Stream text in chunks
            const words = clarificationText.split(" ");
            for (let i = 0; i < words.length; i++) {
              writer.write({
                type: "text-delta",
                id: textId,
                delta: words[i] + (i < words.length - 1 ? " " : ""),
              });
              await new Promise((resolve) => setTimeout(resolve, 30));
            }

            // End text stream
            writer.write({
              type: "text-end",
              id: textId,
            });

            return {
              ...state,
              messages: [
                ...state.messages,
                new AIMessage(
                  "Please provide more details or ask a more specific question so I can better assist you.",
                ),
              ],
            };
          }

          writer.write({
            type: "data-status",
            data: {
              message: `${state.chosenAdvisor} is formulating response...`,
              stage: "advisor",
            },
            transient: true,
          });

          const advisor = state.advisors.find(
            (a: any) =>
              a.name.toLowerCase() === state.chosenAdvisor?.toLowerCase(),
          );

          if (!advisor) {
            writer.write({
              type: "text-start",
              id: textId,
            });
            writer.write({
              type: "text-delta",
              id: textId,
              delta:
                "I encountered an issue selecting the right advisor. Please try rephrasing your question.",
            });
            writer.write({
              type: "text-end",
              id: textId,
            });
            return {
              ...state,
              messages: [
                ...state.messages,
                new AIMessage(
                  "I encountered an issue selecting the right advisor. Please try rephrasing your question.",
                ),
              ],
            };
          }

          const prompt = `You are ${advisor.name}, an expert in ${advisor.expertise}.

            User question: "${state.userQuery}"

            Provide your expert perspective, considering:
            1. Key strategic considerations
            2. Potential risks and tradeoffs
            3. Your recommendation with reasoning

            Respond as ${advisor.name} would, drawing on expertise in ${advisor.expertise}.`;

          const response = await fakeModel.invoke([new HumanMessage(prompt)]);
          const responseText = response.content.toString();

          writer.write({
            type: "text-start",
            id: textId,
          });

          // Stream the text content word by word for realistic effect
          const words = responseText.split(" ");
          for (let i = 0; i < words.length; i++) {
            writer.write({
              type: "text-delta",
              id: textId,
              delta: words[i] + (i < words.length - 1 ? " " : ""),
            });
            // Small delay between words for streaming effect
            await new Promise((resolve) => setTimeout(resolve, 30));
          }

          writer.write({
            type: "text-end",
            id: textId,
          });

          return {
            ...state,
            messages: [...state.messages, response],
          };
        }

        // Route logic
        function routeAfterComplexity(state: GraphState) {
          return state.isComplex ? "supervisor" : "advisor";
        }
        interface Advisor {
          id: string;
          name: string;
          expertise: string;
        }

        const StateAnnotation = Annotation.Root({
          messages: Annotation<BaseMessage[]>({
            reducer: (
              left: BaseMessage[],
              right: BaseMessage | BaseMessage[],
            ) => {
              if (Array.isArray(right)) {
                return left.concat(right);
              }
              return left.concat([right]);
            },
            default: () => [],
          }),
          userQuery: Annotation<string>,
          isComplex: Annotation<boolean>,
          chosenAdvisor: Annotation<string | null>,
          advisors: Annotation<Advisor[]>,
        });

        // Build the graph
        const workflow = new StateGraph(StateAnnotation);

        workflow
          .addNode("complexity_scout", complexityScout)
          .addNode("supervisor", supervisor)
          .addNode("advisor", advisorResponse)
          .addEdge(START, "complexity_scout")
          .addConditionalEdges("complexity_scout", routeAfterComplexity, {
            supervisor: "supervisor",
            advisor: "advisor",
          })
          .addEdge("supervisor", "advisor")
          .addEdge("advisor", END);

        // Compile and run
        const app = workflow.compile();

        await app.invoke({
          messages: [],
          userQuery,
          isComplex: false,
          chosenAdvisor: null,
          advisors,
        });

        writer.write({
          type: "data-status",
          data: { message: "Complete", stage: "done" },
          transient: true,
        });
      },
    });

    return createUIMessageStreamResponse({ stream });
  } catch (error) {
    console.error("Error in advisor-chat route:", error);
    return new Response(
      JSON.stringify({
        error: "Internal server error",
        details: error.message,
      }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
}
