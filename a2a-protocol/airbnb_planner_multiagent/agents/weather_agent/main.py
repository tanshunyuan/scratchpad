import os

import click
import uvicorn
from a2a.server.apps import A2AStarletteApplication
from a2a.server.request_handlers import DefaultRequestHandler
from a2a.server.tasks import InMemoryTaskStore
from a2a.types import (
    AgentCapabilities,
    AgentCard,
    AgentSkill,
)
from dotenv import load_dotenv
from google.adk.artifacts import InMemoryArtifactService
from google.adk.memory.in_memory_memory_service import InMemoryMemoryService
from google.adk.runners import Runner
from google.adk.sessions import InMemorySessionService
from loguru import logger
from weather_agent import (
    create_weather_agent,
)
from weather_executor import (
    WeatherExecutor,
)

load_dotenv()

DEFAULT_HOST = "0.0.0.0"
DEFAULT_PORT = 10001


def main(host: str = DEFAULT_HOST, port: int = DEFAULT_PORT):
    logger.trace("at main...")
    skill = AgentSkill(
        id="weather_search",
        name="Search weather",
        description="Helps with weather in city, or states",
        tags=["weather"],
        examples=["weather in LA, CA"],
    )

    app_url = os.environ.get("APP_URL", f"http://{host}:{port}")

    agent_card = AgentCard(
        name="Weather Agent",
        description="Helps with weather",
        url=app_url,
        version="1.0.0",
        default_input_modes=["text"],
        default_output_modes=["text"],
        capabilities=AgentCapabilities(streaming=True),
        skills=[skill],
    )

    adk_agent = create_weather_agent()
    runner = Runner(
        app_name=agent_card.name,
        agent=adk_agent,
        artifact_service=InMemoryArtifactService(),
        session_service=InMemorySessionService(),
        memory_service=InMemoryMemoryService(),
    )
    agent_executor = WeatherExecutor(runner, agent_card)

    request_handler = DefaultRequestHandler(
        agent_executor=agent_executor, task_store=InMemoryTaskStore()
    )

    a2a_app = A2AStarletteApplication(
        agent_card=agent_card, http_handler=request_handler
    )

    uvicorn.run(a2a_app.build(), host=host, port=port)


@click.command()
@click.option("--host", "host", default=DEFAULT_HOST)
@click.option("--port", "port", default=DEFAULT_PORT)
def cli(host: str, port: int):
    main(host, port)


if __name__ == "__main__":
    main()
