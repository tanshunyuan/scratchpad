
// import { actor, setup } from "rivetkit";

// export const counter = actor({
// 	state: { count: 0 },
// 	actions: {
// 		increment: (c, x: number) => {
// 			c.state.count += x;
// 			c.broadcast("newCount", c.state.count);
// 			return c.state.count;
// 		},
// 	},
// });

// export const registry = setup({
// 	use: { counter },
// });

// registry.start();


import { agentOs } from "rivetkit/agent-os";
import { setup } from "rivetkit";
import common from "@rivet-dev/agent-os-common";
import pi from "@rivet-dev/agent-os-pi";

const vm = agentOs({
  options: { software: [common, pi] },
});

export const registry = setup({ use: { vm } });
registry.start();
