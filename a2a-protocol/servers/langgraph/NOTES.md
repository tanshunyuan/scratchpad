# https://a2a-protocol.org/latest/tutorials/python/7-streaming-and-multiturn/

- https://github.com/a2aproject/a2a-samples/tree/main/samples/python/agents/langgraph

What are:

- from a2a.server.agent_execution import RequestContext; context: RequestContext; context.current_task. Where does the `current_task` come from?

- from a2a.server.tasks import TaskUpdater

- TaskUpdater().add_artifact

- from a2a.utils import (new_task)

- from a2a.types import (Part)

- from a2a.types import (TextPart)

- from a2a.client import A2ACardResolver

===

```py
async def main() -> None:
    # Configure logging to show INFO level messages
    logging.basicConfig(level=logging.INFO)
    logger = logging.getLogger(__name__)  # Get a logger instance

    # --8<-- [start:A2ACardResolver]

    base_url = "http://localhost:10000"

    async with httpx.AsyncClient() as httpx_client:
        resolver = A2ACardResolver(httpx_client=httpx_client, base_url=base_url)

        final_agent_card_to_use: AgentCard | None = None

        try:
            logger.info(
                f"Attempting to fetch public agent card from: {base_url}{AGENT_CARD_WELL_KNOWN_PATH}"
            )

            _public_card = await resolver.get_agent_card()
        except Exception as e:
            logger.error(
                f"Critical error fetching public agent card: {e}", exc_info=True
            )
            raise RuntimeError(
                "Failed to fetch the public agent card. Cannot continue."
            ) from e

```

so it seems like, if we know that the target server uses the A2A protocol, we can use the `A2ACardResolver` to discover the agent on that server and grab its `AgentCard`

Then, we can use `A2AClient` alongside the found `AgentCard` to define how to interact with the A2A agent

```py
client = A2AClient(
            httpx_client=httpx_client, agent_card=final_agent_card_to_use
        )
```

To send a message, we can use `SendMessageRequest` alongside the message we've defined. `MessageSendParams` is used to convert the payload into a proper one.
```py
send_message_payload: dict[str, Any] = {
    "message": {
        "role": "user",
        "parts": [{"kind": "text", "text": "how much is 10 USD in INR?"}],
        "message_id": uuid4().hex,
    },
}

request = SendMessageRequest(
    id=str(uuid4()), params=MessageSendParams(**send_message_payload)
)

response = await client.send_message(request)
print(response.model_dump(mode='json', exclude_none=True))
```

===

Start the server

```
uv run server/main.py
```

Start the client

```
uv run client.py
```
