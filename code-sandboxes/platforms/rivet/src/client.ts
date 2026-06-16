// import { createClient } from "rivetkit/client";
// import type { registry } from "./server.js";

// const RIVET_URL = "http://localhost:6420"
// const client = createClient<typeof registry>(RIVET_URL);

// // Get or create a counter actor for the key "my-counter"
// const counter = client.counter.getOrCreate(["my-counter"]);

// // Call actions
// const count = await counter.increment(3);
// console.log("New count:", count);

// // Listen to realtime events
// const connection = counter.connect();
// connection.on("newCount", (newCount: number) => {
// 	console.log("Count changed:", newCount);
// });

// // Increment through connection
// await connection.increment(1);


import { createClient } from "rivetkit/client";
import type { registry } from "./server.js";

const client = createClient<typeof registry>("http://localhost:6420");
const agent = client.vm.getOrCreate(["my-agent"]);

// Subscribe to streaming events
agent.on("sessionEvent", (data) => {
  console.log(data.event);
});

// Create a session and send a prompt
const session = await agent.createSession("pi", {
  env: { ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY! },
});
await agent.sendPrompt(
  session.sessionId,
  "Write a hello world script to /home/user/hello.js",
);

// Read the file the agent created
const content = await agent.readFile("/home/user/hello.js");
console.log(new TextDecoder().decode(content));
