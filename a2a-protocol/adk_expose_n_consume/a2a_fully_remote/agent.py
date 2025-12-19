import random

from google.adk.agents.llm_agent import Agent
from google.adk.agents.remote_a2a_agent import (
    AGENT_CARD_WELL_KNOWN_PATH,
    RemoteA2aAgent,
)
from google.adk.tools.example_tool import ExampleTool
from google.genai import types

example_tool = ExampleTool(
    [
        {
            "input": {
                "role": "user",
                "parts": [{"text": "Roll a 6-sided die."}],
            },
            "output": [{"role": "model", "parts": [{"text": "I rolled a 4 for you."}]}],
        },
        {
            "input": {
                "role": "user",
                "parts": [{"text": "Is 7 a prime number?"}],
            },
            "output": [
                {
                    "role": "model",
                    "parts": [{"text": "Yes, 7 is a prime number."}],
                }
            ],
        },
        {
            "input": {
                "role": "user",
                "parts": [{"text": "Roll a 10-sided die and check if it's prime."}],
            },
            "output": [
                {
                    "role": "model",
                    "parts": [{"text": "I rolled an 8 for you."}],
                },
                {
                    "role": "model",
                    "parts": [{"text": "8 is not a prime number."}],
                },
            ],
        },
    ]
)

prime_agent = RemoteA2aAgent(
    name="prime_agent",
    description="Agent that handles checking if numbers are prime.",
    agent_card=(f"http://localhost:8002/{AGENT_CARD_WELL_KNOWN_PATH}"),
)

roll_agent = RemoteA2aAgent(
    name="roll_agent",
    description="An agent specialized in rolling dice of various sizes.",
    agent_card=(f"http://localhost:8001/{AGENT_CARD_WELL_KNOWN_PATH}"),
)

root_agent = Agent(
    model="gemini-2.5-flash",
    name="root_agent",
    instruction="""
        You are a helpful assistant that can roll dice and check if numbers are prime.
        You delegate rolling dice tasks to the roll_agent and prime checking tasks to the check_prime_agent.

        CRITICAL RULES:
        - ALWAYS complete ALL requested operations before providing your final response
        - For multi-step requests, you MUST call all required agents in sequence
        - Never stop after completing only the first step

        Task Handling:

        1. Roll a die only:
           - Call roll_agent with the number of sides
           - Wait for the response
           - Report the dice roll result to the user (e.g., "I rolled a 4 for you.")

        2. Check if a number is prime only:
           - Call prime_agent with the number
           - Wait for the response
           - Report whether it's prime or not to the user

        3. Roll a die, THEN check if the result is prime:
           - Step 3a: Call roll_agent to get the dice result (e.g., "You rolled a 7")
           - Step 3b: Call prime_agent with that rolled number to check if it's prime
           - Step 3c: Report BOTH: the roll result AND the prime status
.
    """,
    global_instruction=(
        "You are DicePrimeBot, ready to roll dice and check prime numbers."
    ),
    sub_agents=[roll_agent, prime_agent],
    tools=[example_tool],
    generate_content_config=types.GenerateContentConfig(
        safety_settings=[
            types.SafetySetting(  # avoid false alarm about rolling dice.
                category=types.HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
                threshold=types.HarmBlockThreshold.OFF,
            ),
        ]
    ),
)
