import logging
from typing import Any
from uuid import uuid4

import httpx
from a2a.client import A2ACardResolver, A2AClient
from a2a.types import MessageSendParams, SendMessageRequest


async def main() -> None:
    # Configure logging to show INFO level messages
    logging.basicConfig(level=logging.INFO)
    logger = logging.getLogger(__name__)  # Get a logger instance

    base_url = "http://localhost:9999"

    async with httpx.AsyncClient() as httpx_client:
        # A2ACardResolver, a conv fn that fetches the agent card details from `/.well-known/agent-card.json`
        resolver = A2ACardResolver(httpx_client=httpx_client, base_url=base_url)

        agent_card = await resolver.get_agent_card()

        client = A2AClient(httpx_client=httpx_client, agent_card=agent_card)

        logger.info("A2AClient initialized")

        send_message_payload: dict[str, Any] = {
            "message": {
                "role": "user",
                "parts": [{"kind": "text", "text": "how much is 10 USD in INR?"}],
                "messageId": uuid4().hex,
            },
        }

        # no `get_task` or `cancel_task` here because the HelloWorld agent in `server/agent_executor
        request = SendMessageRequest(
            id=str(uuid4()), params=MessageSendParams(**send_message_payload)
        )

        # {
        #   'id': '300edbdb-4e66-497f-9739-0d1146b3ae80',
        #   'jsonrpc': '2.0',
        #   'result': {'kind': 'message', 'messageId': '3638dab6-8c62-4639-99a0-54e299232dfd', 'parts': [{'kind': 'text', 'text': 'Hello World'}], 'role': 'agent'}
        # }
        response = await client.send_message(request)

        print(response.model_dump(mode="json", exclude_none=True))


if __name__ == "__main__":
    import asyncio

    asyncio.run(main())
