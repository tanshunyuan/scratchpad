import random

from google.adk.agents.llm_agent import Agent
from google.adk.agents.remote_a2a_agent import (
    AGENT_CARD_WELL_KNOWN_PATH,
    RemoteA2aAgent,
)
from google.adk.tools.example_tool import ExampleTool
from google.genai import types

from ._local_agents.roll_agent import roll_agent

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
        {
            "input": {
                "role": "user",
                "parts": [{"text": "Check if 11 is prime and then roll a die."}],
            },
            "output": [
                {
                    "role": "model",
                    "parts": [{"text": "Yes, 11 is a prime number."}],
                },
                {
                    "role": "model",
                    "parts": [{"text": "I rolled a 3 for you."}],
                },
            ],
        },
    ]
)

# REMOTE AGENT
check_prime_agent = RemoteA2aAgent(
    name="check_prime_agent",
    description="Agent that handles checking if numbers are prime.",
    agent_card=(
        f"http://localhost:8001/a2a/check_prime_agent{AGENT_CARD_WELL_KNOWN_PATH}"
    ),
)

# ROOT AGENT AKA CLIENT / ORCHESTRATOR AGENT
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
           - Call check_prime_agent with the number
           - Wait for the response
           - Report whether it's prime or not to the user

        3. Roll a die, THEN check if the result is prime:
           - Step 3a: Call roll_agent to get the dice result (e.g., "You rolled a 7")
           - Step 3b: Call check_prime_agent with that rolled number to check if it's prime
           - Step 3c: Report BOTH: the roll result AND the prime status

        4. Check if a number is prime, THEN roll a die:
           - Step 4a: Call check_prime_agent to check if the specified number is prime
           - Step 4b: Call roll_agent to roll a dice (you MUST do this step - it is NOT optional)
           - Step 4c: Report BOTH: the prime check result AND the dice roll result

        REMINDER: In steps 3 and 4, you must make TWO agent calls (one to each agent) and report both results.
        Do not consider the task complete until you have called both agents and received both results.
    """,
    global_instruction=(
        "You are DicePrimeBot, ready to roll dice and check prime numbers."
    ),
    sub_agents=[roll_agent, check_prime_agent],
    # tools=[example_tool],
    generate_content_config=types.GenerateContentConfig(
        safety_settings=[
            types.SafetySetting(
                category=types.HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
                threshold=types.HarmBlockThreshold.OFF,
            ),
        ]
    ),
)
