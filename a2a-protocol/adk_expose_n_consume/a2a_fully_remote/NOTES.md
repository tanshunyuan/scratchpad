somehow when its two remote agent, it can't perform a handoff

```
User: Roll a 10-sided die and check if it's prime
Assistant: 
Tool 'transfer_to_agent' not found. Available tools: roll_die

Possible causes:

    LLM hallucinated the function name - review agent instruction clarity
    Tool not registered - verify agent.tools list
    Name mismatch - check for typos

Suggested fixes:

    Review agent instruction to ensure tool usage is clear
    Verify tool is included in agent.tools list
    Check for typos in function name


```
* https://github.com/google/adk-python/discussions/3330
* https://github.com/google/adk-docs/issues/644
