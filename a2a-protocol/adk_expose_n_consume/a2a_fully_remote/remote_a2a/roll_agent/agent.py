import os
import random

from a2a.types import AgentCapabilities, AgentCard, AgentSkill
from dotenv import load_dotenv
from google.adk import Agent
from google.adk.a2a.utils.agent_to_a2a import to_a2a
from google.adk.tools.tool_context import ToolContext
from google.genai import types

load_dotenv()

GOOGLE_API_KEY = os.environ.get("GOOGLE_API_KEY")


def roll_die(sides: int) -> int:
    """Roll a die and return the rolled result."""
    return random.randint(1, sides)


roll_agent = Agent(
    name="roll_agent",
    model="gemini-2.5-flash",
    description="Handles rolling dice of different sizes.",
    instruction="""
      You are responsible for rolling dice based on the user's request.
      When asked to roll a die, you must call the roll_die tool with the number of sides as an integer.
    """,
    tools=[roll_die],
    generate_content_config=types.GenerateContentConfig(
        safety_settings=[
            types.SafetySetting(  # avoid false alarm about rolling dice.
                category=types.HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
                threshold=types.HarmBlockThreshold.OFF,
            ),
        ]
    ),
)

agent_card = AgentCard(
    name="roll_agent",
    url="http://localhost:8001",
    description="An agent specialized in rolling dice of various sizes.",
    version="1.0.0",
    capabilities=AgentCapabilities(),
    skills=[
        AgentSkill(
            id="dice_rolling",
            name="Dice Rolling",
            description="Simulate random rolls of dice with a specified number of sides",
            tags=["random", "dice", "probability", "simulation"],
        )
    ],
    default_input_modes=["text/plain"],
    default_output_modes=["text/plain"],
    supports_authenticated_extended_card=False,
)

roll_agent_a2a_app = to_a2a(agent=roll_agent, agent_card=agent_card, port=8001)

if __name__ == "__main__":
    import uvicorn

    uvicorn.run(roll_agent_a2a_app, host="localhost", port=8001)
