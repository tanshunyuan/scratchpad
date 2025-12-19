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

=== Misc

* FastMCP is a python library used to create MCP servers
* use `.get` on a dict for safer access, as we can create fallbacks. `dict.get(<key>, <fallback>)`
