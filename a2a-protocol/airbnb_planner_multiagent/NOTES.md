# LiteLlm

LiteLlm is a middleware layer that allows applications to access different llms on one platform.
Additionally, it uses the A2A as a gateway to connect with other agents, docs [here](https://docs.litellm.ai/docs/a2a).

## QnA

### What's the point of defining a LiteLlmModel and passing it to the ADK agent?

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
* We can only pass gemini model as a string to the `model` parameter as ADK has first class support for it. However, if we want to use other models such as Antrophic is a lot more cumbersome like [here](https://google.github.io/adk-docs/agents/models/#using-anthropic-models). Meanwhile, by using the LiteLlm wrapper that ADK provides, we can simply swap llms by altering the model name. All the underlying abstraction and translation is taken care of by LiteLlm


# FastMCP

## QnA

### Why use a MCP here when you can define your own tools?
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
* My hunch is that the guide wanted to show how to create your own MCPServer and integrate MCPTools

# Weather Agent

## QnA

### Why does it require a conversion from GenAI to A2A and vice-versa?
```py
from a2a.types import (
    AgentCard,
    FilePart,
    FileWithBytes,
    FileWithUri,
    Part,
    TaskState,
    TextPart,
    UnsupportedOperationError,
)
from google.genai import types
def convert_a2a_part_to_genai(part: Part) -> types.Part:
    """Convert a single A2A Part type into a Google Gen AI Part type.

    Args:
        part: The A2A Part to convert

    Returns:
        The equivalent Google Gen AI Part

    Raises:
        ValueError: If the part type is not supported
    """

    logger.trace(f"convert_a2a_part_to_genai.part ==> {pformat(vars(part))}")

    part_root = part.root

    if isinstance(part_root, TextPart):
        return types.Part(text=part_root.text)
    if isinstance(part_root, FilePart):
        if isinstance(part_root.file, FileWithUri):
            return types.Part(
                file_data=types.FileData(
                    file_uri=part_root.file.uri, mime_type=part_root.file.mime_type
                )
            )
        if isinstance(part_root.file, FileWithBytes):
            return types.Part(
                inline_data=types.Blob(
                    data=part_root.file.bytes.encode(), mime_type=part_root.file.mime_type
                )
            )
        raise ValueError(f"Unsupported file type: {type(part_root.file)}")
    raise ValueError(f"Unsupported part type: {type(part_root)}")


def convert_genai_part_to_a2a(part: types.Part) -> Part:
    """Convert a single Google Gen AI Part type into an A2A Part type.

    Args:
        part: The Google Gen AI Part to convert

    Returns:
        The equivalent A2A Part

    Raises:
        ValueError: If the part type is not supported
    """
    if part.text:
        return TextPart(text=part.text)
    if part.file_data and part.file_data.file_uri:
        return FilePart(
            file=FileWithUri(
                uri=part.file_data.file_uri,
                mime_type=part.file_data.mime_type,
            )
        )
    if part.inline_data and part.inline_data.data:
        return Part(
            root=FilePart(
                file=FileWithBytes(
                    bytes=part.inline_data.data.decode(),
                    mime_type=part.inline_data.mime_type,
                )
            )
        )
    raise ValueError(f"Unsupported part type: {part}")
```

# Airbnb Agent

## QnA

### What is this syntax?
```py
structured_response = (
    state_values.get('structured_response')
    if isinstance(state_values, dict)
    else getattr(state_values, 'structured_response', None)
)
```
* its a tenary condition. if state_values is a type of dict, use the `.get` method to extract the value. Else use the `getattr` method to extract the value
* This is how a traditional if/else block would look like
```py
if isinstance(state_values, dict):
   structured_response = state_values.get('structured_response')
else:
  structured_response = getattr(state_values, 'structured_response', None)
```

# Google ADK

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


# Tips

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



# Misc

* FastMCP is a python library used to create MCP servers
* use `.get` on a dict for safer access, as we can create fallbacks. `dict.get(<key>, <fallback>)`
