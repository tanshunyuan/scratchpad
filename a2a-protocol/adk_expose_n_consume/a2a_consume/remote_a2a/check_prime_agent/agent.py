import os

from dotenv import load_dotenv
from google.adk import Agent
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


# This doesn't use `to_a2a` because we're using the cli `adk api_server --a2a --port 8001 <path-to-here>
root_agent = Agent(
    name="check_prime_agent",
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
