- a plan is generated and written to disk for future reference
- filesystem used to do a few things (long-term-memory):
  - offload context, allow the agent to run off to do its thing, and when it comes back it'll reference the context to ensure the generated content is in line
  - offload tool message, when the content is needed just summarise the results back, prevent raw tool observation from bursting the llm context window
- ![alt text](./assets/table-usage.png)

- We can use `Injected<something>` to allow a tool to recieve a STATE, without passing the state to an llm. Use `Command` class to update langgraph state and tell the agent where to go next
  - this is deprecated in langchain v1, now it uses `ToolRuntime`: https://docs.langchain.com/oss/python/langchain/tools#accessing-context
- `create-react-agent` performs parallel tool calls by default
- claude code has a tool called `TodoWrite` for planning; manus uses a `todo.md` file
- files as reference
- Instead of a planner step, seems like others like to use tools to: create, read, write plans to a file or state
- Seems like subagents are used as a tool instead of a specific node

===

1. If I want to use files as context, where do I store them? Such that it is easily accessible for both the users and agent


# Final Thoughts

1. A good crash course on how to build deep agents from scratch
2. Would've love to see how they'd handle actual files as a context, instead of mocking it in state
3. Shows how versatile tools are, for example:
    - plan tool: use it to create a plan for the agent to follow, instead of being a node (plan and execute)
    - subagent tool: create a subagent on the fly as a tool, instead of being part of a subgraph
4. Instead of creating say a specific planner node or a step to spawn parallel nodes, this course creates them as a form of tool and allow the agent to use the appropiate tool when needed.