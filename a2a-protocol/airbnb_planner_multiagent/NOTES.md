=== LiteLlm
LiteLlm has a A2A protocol adaptation as well. Interestingly, I can do the following:

```py
from google.adk.agents import LlmAgent as ADKLlmAgent
from google.adk.models.lite_llm import LiteLlm as LiteLlmModel

def create_weather_agent() -> ADKLlmAgent:
    """Constructs the ADK agent"""
    return ADKLlmAgent(
        model=LiteLlmModel(model="gemini-2.5-flash"), # What's the point of this? Can't I just pass in the model name as string?
        ...
    )
```
* seems like LiteLlm simplies the usage of different models from varying providers, in this case, it has a ADK adaptation where it allows the adkllmagent to ... (forgot what i want to say)


=== FastMCP
```py
from google.adk.agents import LlmAgent as ADKLlmAgent
from google.adk.tools.mcp_tool.mcp_toolset import (
    MCPToolset,
)
from mcp.client.stdio import StdioServerParameters

def create_weather_agent() -> ADKLlmAgent:
    """Constructs the ADK agent"""
    return ADKLlmAgent(
        ...
        tools=[
            MCPToolset(
                connection_params=StdioServerParameters(
                    command="python",
                    args=["./weather_mcp.py"],
                ),
            )
        ],
    )

```
* Why use a MCP here when you can define your own tools?

=== Weather Agent

## QnA

### Why does it require a conversion from GenAI to A2A and vice-versa?

=== Airbnb Agent

## QnA

### What is this syntax?
```py
structured_response = (
    state_values.get('structured_response')
    if isinstance(state_values, dict)
    else getattr(state_values, 'structured_response', None)
)
```
* 

=== Google ADK

## QnA

### What is `SessionService`?

```py
from google.adk.sessions import InMemorySessionService
APP_NAME = "routing_app"
USER_ID = "default_user"
SESSION_ID = "default_session"
SESSION_SERVICE = InMemorySessionService()

await SESSION_SERVICE.create_session(
    app_name=APP_NAME, user_id=USER_ID, session_id=SESSION_ID
)
```
* It's similar to langgraph `Memory`, it keeps a history of the conversation state

### What is Event Loop?
* https://google.github.io/adk-docs/runtime/#core-idea-the-event-loop


=== Tips

## 001

Form a consistent contract regardless of success or failure 
```py
except httpx.HTTPStatusError as http_err:
    logger.error(
        f'HTTPStatusError in Airbnb.ainvoke (Airbnb task): {http_err.response.status_code} - {http_err}',
        exc_info=True,
    )
    return {
        'is_task_complete': True,
        'require_user_input': False,
        'content': f'An error occurred with an external service for Airbnb task: {http_err.response.status_code}',
    }
except Exception as e:
    logger.error(
        f'Unhandled exception in AirbnbAgent.ainvoke (Airbnb task): {type(e).__name__} - {e}',
        exc_info=True,
    )
    # Consider whether to re-raise or return a structured error
    return {
        'is_task_complete': True,  # Or False, marking task as errored
        'require_user_input': False,
        'content': f'An unexpected error occurred while processing your airbnb task: {type(e).__name__}.',
    }
```



=== Misc

* FastMCP is a python library used to create MCP servers
* use `.get` on a dict for safer access, as we can create fallbacks. `dict.get(<key>, <fallback>)`
