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
  console.log("at POST /api/chat-mock");
  try {
    const rawBody = await req.json();
    const body = await requestSchema.parseAsync(rawBody);

    const { messages, advisors } = body;

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
          // transient: true,
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
          const selectedAdvisors = advisors.slice(0, 2);
          const advisorNames = selectedAdvisors.map((a) => a.name).join(", ");

          mockResponses = [
            "COMPLEX", // Complexity scout says it's complex
            advisorNames, // Supervisor picks multiple advisors (comma-separated)
            // First advisor response
            `As ${selectedAdvisors[0].name}, an expert in ${selectedAdvisors[0].expertise}, I'll share my perspective.

            Based on my analysis of your question, here are my key recommendations:

            **Strategic Considerations**: This requires a balanced approach that considers both short-term gains and long-term sustainability. The market dynamics suggest we should prioritize user value over rapid growth.

            **Risk Assessment**: The main risks include market saturation, competitive pressure, and potential regulatory changes. I recommend building in flexibility to pivot as needed.

            **My Recommendation**: I suggest a phased approach where we test core assumptions in small pilots before full commitment. This de-risks the decision while allowing us to learn and adapt.`,
            // Second advisor response
            `As ${selectedAdvisors[1].name}, an expert in ${selectedAdvisors[1].expertise}, let me add my technical perspective.

             From an engineering standpoint, here's what I'd consider:

             **Technical Architecture**: We need a scalable foundation that can handle growth without major rewrites. I'd recommend a modular architecture that allows us to swap components as needs evolve.

             **Implementation Strategy**: Start with a minimal viable technical stack, validate performance under load, then iterate. Avoid over-engineering early, but build in observability from day one.

             **Key Success Factors**: Strong testing practices, clear documentation, and regular technical reviews will be critical to maintaining quality as we scale.`,
          ];
        } else {
          // Not complex path: complexity scout asks for more details
          mockResponses = [
            `NOT_COMPLEX - To provide better guidance, could you elaborate on:
            - What specific aspects are you most concerned about?
            - What constraints or requirements do you have?
            - What's your timeline for making this decision?

            This will help me route you to the right advisor with more targeted advice.`,
          ];
        }

        // Create fake model with predefined responses
        const fakeModel = new FakeListChatModel({
          responses: mockResponses,
          sleep: 100, // Simulate API delay
        });

        // Step 1: Complexity Scout
        async function complexityScout(state: typeof StateAnnotation.State) {
          const prompt = `Analyze this user request: "${state.userQuery}"

            Is this request complex enough to warrant advisor input? A complex request:
            - Requires strategic thinking or tradeoffs
            - Involves multiple perspectives
            - Has significant implications
            - Needs expert judgment

            Respond with ONLY "COMPLEX" or "NOT_COMPLEX" followed by a brief clarifying question if not complex.`;

          const response = await fakeModel.invoke([new HumanMessage(prompt)]);
          console.log("complexityScout.response ==> ", response);
          const content = response.content.toString();
          const isComplex =
            content.includes("COMPLEX") && !content.includes("NOT_COMPLEX");

          if (!isComplex) {
            const textId = "clarification-response";
            writer.write({ type: "text-start", id: textId });

            const words = content.split(" ");
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
            isComplex,
            messages: [response],
          };
        }

        // Step 2: Supervisor
        async function supervisor(
          state: typeof StateAnnotation.State,
        ): Promise<Partial<typeof StateAnnotation.State>> {
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

          const prompt = `Given this request: "${state.userQuery}"

            Available advisors:
            ${advisorList}

            Which advisor is BEST suited to answer this? Respond with ONLY the advisor's name, nothing else.`;

          const response = await fakeModel.invoke([new HumanMessage(prompt)]);
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

          // Loop through each chosen advisor
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

            const prompt = `You are ${advisor.name}, an expert in ${advisor.expertise}.

           User question: "${state.userQuery}"

           Provide your expert perspective, considering:
           1. Key strategic considerations
           2. Potential risks and tradeoffs
           3. Your recommendation with reasoning

           Respond as ${advisor.name} would, drawing on expertise in ${advisor.expertise}.`;

            const response = await fakeModel.invoke([new HumanMessage(prompt)]);
            console.log(`advisorResponse[${i}].response ==> `, response);
            const responseText = response.content.toString();

            writer.write({ type: "text-start", id: textId });

            // Stream the text content word by word for realistic effect
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
            messages: responses,
          };
        }

        // Route logic
        function routeAfterComplexity(state: typeof StateAnnotation.State) {
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
          advisors,
        });

        writer.write({
          type: "data-status",
          data: { message: "Complete", stage: "done" },
          // transient: true,
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
