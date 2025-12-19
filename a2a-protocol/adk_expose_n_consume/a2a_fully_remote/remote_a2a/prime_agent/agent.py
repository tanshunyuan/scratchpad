import os

from a2a.types import AgentCapabilities, AgentCard, AgentSkill
from dotenv import load_dotenv
from google.adk import Agent
from google.adk.a2a.utils.agent_to_a2a import to_a2a
from google.genai import types

load_dotenv()

GOOGLE_API_KEY = os.environ.get("GOOGLE_API_KEY")


async def check_prime(nums: list[int]) -> str:
    """Check if a given list of numbers are prime.

    Args:
      nums: The list of numbers to check.

    Returns:
      A str indicating which number is prime.
    """
    primes = set()
    for number in nums:
        number = int(number)
        if number <= 1:
            continue
        is_prime = True
        for i in range(2, int(number**0.5) + 1):
            if number % i == 0:
                is_prime = False
                break
        if is_prime:
            primes.add(number)
    return (
        "No prime numbers found."
        if not primes
        else f"{', '.join(str(num) for num in primes)} are prime numbers."
    )


prime_agent = Agent(
    name="prime_agent",
    model="gemini-2.5-flash",
    description="check prime agent that can check whether numbers are prime.",
    instruction="""
      You check whether numbers are prime.
      When checking prime numbers, call the check_prime tool with a list of integers. Be sure to pass in a list of integers. You should never pass in a string.
      You should not rely on the previous history on prime results.
    """,
    tools=[
        check_prime,
    ],
    # planner=BuiltInPlanner(
    #     thinking_config=types.ThinkingConfig(
    #         include_thoughts=True,
    #     ),
    # ),
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
    name="prime_agent",
    url="http://localhost:8002",
    description="An agent specialized in checking whether numbers are prime. It can efficiently determine the primality of individual numbers or lists of numbers.",
    version="1.0.0",
    capabilities=AgentCapabilities(),
    skills=[
        AgentSkill(
            id="prime_checking",
            name="Prime Number Checking",
            description="Check if numbers in a list are prime using efficient mathematical algorithms",
            tags=["mathematical", "computation", "prime", "numbers"],
        )
    ],
    default_input_modes=["text/plain"],
    default_output_modes=["text/plain"],
    supports_authenticated_extended_card=False,
)

prime_agent_a2a_app = to_a2a(agent=prime_agent, agent_card=agent_card, port=8002)

if __name__ == "__main__":
    import uvicorn

    uvicorn.run(prime_agent_a2a_app, host="localhost", port=8002)
