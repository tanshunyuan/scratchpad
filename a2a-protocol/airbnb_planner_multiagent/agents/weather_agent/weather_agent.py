import os
from pathlib import Path

from dotenv import load_dotenv
from google.adk.agents import LlmAgent as ADKLlmAgent
from google.adk.models.lite_llm import LiteLlm as LiteLlmModel

# from google.adk.tools.mcp_tool.mcp_toolset import MCPToolset, StdioServerParameters
from google.adk.tools.mcp_tool import McpToolset
from google.adk.tools.mcp_tool.mcp_session_manager import StdioConnectionParams
from loguru import logger
from mcp import StdioServerParameters

load_dotenv()

GOOGLE_API_KEY = os.environ.get("GOOGLE_API_KEY")


def create_weather_agent() -> ADKLlmAgent:
    """Constructs the ADK agent"""
    logger.trace("at create_weather_agent...")
    current_dir = Path(__file__).parent
    weather_mcp_path = str(current_dir / "weather_mcp.py")

    return ADKLlmAgent(
        # model=LiteLlmModel(model="gemini-2.5-flash"),
        model="gemini-2.5-flash",
        name="weather_agent",
        description="An agent that can answer weather related questions",
        instruction="""
            You are a specialized weather forecast assistant.
            Your primary function is to utilize the provided tools to retrieve and relay weather information in response to user queries.
            You must rely exclusively on these tools for data and refrain from inventing information.
            Ensure that all responses include the detailed output from the tools used and are formatted in Markdown
        """,
        tools=[
            McpToolset(
                connection_params=StdioConnectionParams(
                    server_params=StdioServerParameters(
                        command="python", args=[weather_mcp_path]
                    )
                )
            )
        ],
    )
