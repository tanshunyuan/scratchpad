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
const agent = client.vm.getOrCreate(['my-agent'])

agent.connect().on('sessionEvent', (data) => {
  console.log(data)
})

const session = await agent.
