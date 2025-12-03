// import { StreamingTextResponse, LangChainAdapter } from 'ai';
// import { StateGraph, END } from '@langchain/langgraph';
// import { ChatAnthropic } from '@langchain/anthropic';
// import { HumanMessage, AIMessage } from '@langchain/core/messages';

// // State shape for the graph
// interface GraphState {
//   messages: any[];
//   userQuery: string;
//   isComplex: boolean;
//   chosenAdvisor: string | null;
//   advisors: any[];
// }

// export async function POST(req: Request) {
//   const { messages, advisors } = await req.json();

//   if (!advisors || advisors.length === 0) {
//     return new Response('No advisors provided', { status: 400 });
//   }

//   const userQuery = messages[messages.length - 1].content;

//   // Initialize Claude
//   const model = new ChatAnthropic({
//     modelName: 'claude-sonnet-4-20250514',
//     temperature: 0.7,
//   });

//   // Step 1: Complexity Scout
//   async function complexityScout(state: GraphState) {
//     const prompt = `Analyze this user request: "${state.userQuery}"

// Is this request complex enough to warrant advisor input? A complex request:
// - Requires strategic thinking or tradeoffs
// - Involves multiple perspectives
// - Has significant implications
// - Needs expert judgment

// Respond with ONLY "COMPLEX" or "NOT_COMPLEX" followed by a brief clarifying question if not complex.`;

//     const response = await model.invoke([new HumanMessage(prompt)]);
//     const content = response.content.toString();

//     return {
//       ...state,
//       isComplex: content.includes('COMPLEX') && !content.includes('NOT_COMPLEX'),
//       messages: [...state.messages, response],
//     };
//   }

//   // Step 2: Supervisor
//   async function supervisor(state: GraphState) {
//     if (!state.isComplex) {
//       return { ...state, chosenAdvisor: null };
//     }

//     const advisorList = state.advisors
//       .map((a: any) => `- ${a.name}: ${a.expertise}`)
//       .join('\n');

//     const prompt = `Given this request: "${state.userQuery}"

// Available advisors:
// ${advisorList}

// Which advisor is BEST suited to answer this? Respond with ONLY the advisor's name, nothing else.`;

//     const response = await model.invoke([new HumanMessage(prompt)]);
//     const chosenName = response.content.toString().trim();

//     return {
//       ...state,
//       chosenAdvisor: chosenName,
//       messages: [...state.messages, response],
//     };
//   }

//   // Step 3: Chosen Advisor
//   async function advisorResponse(state: GraphState) {
//     if (!state.chosenAdvisor) {
//       return {
//         ...state,
//         messages: [
//           ...state.messages,
//           new AIMessage('Please provide more details or ask a more specific question.'),
//         ],
//       };
//     }

//     const advisor = state.advisors.find(
//       (a: any) => a.name.toLowerCase() === state.chosenAdvisor?.toLowerCase()
//     );

//     const prompt = `You are ${advisor.name}, an expert in ${advisor.expertise}.

// User question: "${state.userQuery}"

// Provide your expert perspective, considering:
// 1. Key strategic considerations
// 2. Potential risks and tradeoffs
// 3. Your recommendation with reasoning

// Respond as ${advisor.name} would, drawing on expertise in ${advisor.expertise}.`;

//     const response = await model.invoke([new HumanMessage(prompt)]);

//     return {
//       ...state,
//       messages: [...state.messages, response],
//     };
//   }

//   // Route logic
//   function routeAfterComplexity(state: GraphState) {
//     return state.isComplex ? 'supervisor' : 'advisor';
//   }

//   // Build the graph
//   const workflow = new StateGraph<GraphState>({
//     channels: {
//       messages: { value: (x: any[], y: any[]) => x.concat(y) },
//       userQuery: { value: (x: string) => x },
//       isComplex: { value: (x: boolean) => x },
//       chosenAdvisor: { value: (x: string | null) => x },
//       advisors: { value: (x: any[]) => x },
//     },
//   });

//   // Add nodes
//   workflow.addNode('complexity_scout', complexityScout);
//   workflow.addNode('supervisor', supervisor);
//   workflow.addNode('advisor', advisorResponse);

//   // Add edges
//   workflow.addEdge('__start__', 'complexity_scout');
//   workflow.addConditionalEdges('complexity_scout', routeAfterComplexity);
//   workflow.addEdge('supervisor', 'advisor');
//   workflow.addEdge('advisor', END);

//   // Compile and run
//   const app = workflow.compile();

//   const result = await app.invoke({
//     messages: [],
//     userQuery,
//     isComplex: false,
//     chosenAdvisor: null,
//     advisors,
//   });

//   // Extract final message
//   const finalMessage = result.messages[result.messages.length - 1];
//   const stream = new ReadableStream({
//     start(controller) {
//       controller.enqueue(finalMessage.content);
//       controller.close();
//     },
//   });

//   return new StreamingTextResponse(stream);
// }
