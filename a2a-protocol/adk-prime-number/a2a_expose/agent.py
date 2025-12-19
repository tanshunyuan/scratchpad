from google.adk.agents.remote_a2a_agent import (
    AGENT_CARD_WELL_KNOWN_PATH,
    RemoteA2aAgent,
)

# Exposes the dice-master agent | A RemoteA2aAgent that connects to the remote A2A service
root_agent = RemoteA2aAgent(  # `RemoteA2aAgent` is a sugar syntax that I do not understand, but seems like `uv run adk web` uses it.
    name="dice_master_agent",
    description=(
        "Helpful assistant that can roll dice and check if numbers are prime."
    ),
    agent_card=f"http://localhost:8001/{AGENT_CARD_WELL_KNOWN_PATH}",
)
