import z from "zod";
import { chefAgent } from "../mastra/agents/chef-agent";
import { stockAgent } from "../mastra/agents/stock-agent";
import { searchAgent } from "../mastra/agents/search-agent";
import { mastra } from '../mastra'

async function testResearchAgent() {
  // Basic query about concepts
  // const researchAgent = mastra.getAgent("researchAgent");
  const query1 =
    "What problems does sequence modeling face with neural networks?";
  const query2 = "What improvements were achieved in translation quality?";
  const researchAgent = mastra.getAgent('researchAgent')
  const response1 = await researchAgent.generate(query2);
  console.log("\nQuery:", query2);
  console.log("Response:", response1.text);
}
testResearchAgent();

async function testSearchAgent() {
  const query = "What happened last week in AI news?";
  console.log(`Query: ${query}`);

  const blockingResponse = async ({ query }: { query: string }) => {
    const response = await searchAgent.generate([
      { role: "user", content: query },
    ]);
    console.log(response);
  };

  await blockingResponse({ query });
}
// testSearchAgent();

async function testStockAgent() {
  const query = "What is the current stock price of Apple (AAPL)?";
  console.log(`Query: ${query}`);

  const blockingResponse = async ({ query }: { query: string }) => {
    const response = await stockAgent.generate([
      { role: "user", content: query },
    ]);
    console.log(response);
  };

  await blockingResponse({ query });
}
// testStockAgent();

async function testChefAgent() {
  const query =
    "In my kitchen I have: pasta, canned tomatoes, garlic, olive oil, and some dried herbs (basil and oregano). What can I make?";
  console.log(`Query: ${query}`);

  const blockingResponse = async ({ query }: { query: string }) => {
    const response = await chefAgent.generate([
      { role: "user", content: query },
    ]);
    console.log("\n👨‍🍳 Chef Michel:", response.text);
  };

  const streamingResponse = async ({ query }: { query: string }) => {
    const stream = await chefAgent.stream([{ role: "user", content: query }]);
    console.log("\n Chef Michel: ");

    for await (const chunk of stream.textStream) {
      process.stdout.write(chunk);
    }

    console.log("\n\n✅ Recipe complete!");
  };

  const structuredResponse = async ({ query }: { query: string }) => {
    const schema = z.object({
      ingredients: z.array(
        z.object({
          name: z.string(),
          amount: z.string(),
        }),
      ),
      steps: z.array(z.string()),
    });

    const response = await chefAgent.generate(
      [{ role: "user", content: query }],
      {
        structuredOutput: {
          schema,
        },
      },
    );

    console.log("\n👨‍🍳 Chef Michel:", response.object);
  };

  // await blockingResponse({query})
  // await streamingResponse({query})
  await structuredResponse({ query });
}

// testChefAgent();
