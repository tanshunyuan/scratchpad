import logging
from typing import Any
from uuid import uuid4

import httpx
from a2a.client import A2ACardResolver, A2AClient
from a2a.types import (
    AgentCard,
    MessageSendParams,
    SendMessageRequest,
    SendStreamingMessageRequest,
)
from a2a.utils.constants import (
    AGENT_CARD_WELL_KNOWN_PATH,
    EXTENDED_AGENT_CARD_PATH,
)


async def main() -> None:
    # Configure logging to show INFO level messages
    logging.basicConfig(level=logging.INFO)
    logger = logging.getLogger(__name__)  # Get a logger instance

    # --8<-- [start:A2ACardResolver]

    base_url = "http://localhost:10000"

    async with httpx.AsyncClient(timeout=60.0) as httpx_client:
        resolver = A2ACardResolver(httpx_client=httpx_client, base_url=base_url)

        final_agent_card_to_use: AgentCard | None = None

        # This block of try catch is just establishing the agent card first
        try:
            logger.info(
                f"Attempting to fetch public agent card from: {base_url}{AGENT_CARD_WELL_KNOWN_PATH}"
            )

            _public_card = await resolver.get_agent_card()
            logger.info("Successfully fetched public agent card:")
            logger.info(_public_card.model_dump_json(indent=2, exclude_none=True))
            final_agent_card_to_use = _public_card
            logger.info(
                "\nUsing PUBLIC agent card for client initialization (default)."
            )
            if _public_card.supports_authenticated_extended_card:
                try:
                    logger.info(
                        "\nPublic card supports authenticated extended card. "
                        "Attempting to fetch from: "
                        f"{base_url}{EXTENDED_AGENT_CARD_PATH}"
                    )
                    auth_headers_dict = {
                        "Authorization": "Bearer dummy-token-for-extended-card"
                    }
                    _extended_card = await resolver.get_agent_card(
                        relative_card_path=EXTENDED_AGENT_CARD_PATH,
                        http_kwargs={"headers": auth_headers_dict},
                    )
                    logger.info(
                        "Successfully fetched authenticated extended agent card:"
                    )
                    logger.info(
                        _extended_card.model_dump_json(indent=2, exclude_none=True)
                    )
                    final_agent_card_to_use = (
                        _extended_card  # Update to use the extended card
                    )
                    logger.info(
                        "\nUsing AUTHENTICATED EXTENDED agent card for client "
                        "initialization."
                    )
                except Exception as e_extended:
                    logger.warning(
                        f"Failed to fetch extended agent card: {e_extended}. "
                        "Will proceed with public card.",
                        exc_info=True,
                    )
            elif _public_card:  # supports_authenticated_extended_card is False or None
                logger.info(
                    "\nPublic card does not indicate support for an extended card. Using public card."
                )

        except Exception as e:
            logger.error(
                f"Critical error fetching public agent card: {e}", exc_info=True
            )
            raise RuntimeError(
                "Failed to fetch the public agent card. Cannot continue."
            ) from e

        client = A2AClient(
            httpx_client=httpx_client, agent_card=final_agent_card_to_use
        )

        # await run_single_turn(client=client, logger=logger)
        # await run_multiturn(client=client, logger=logger)
        await run_streaming(client=client, logger=logger)


async def run_single_turn(client: A2AClient, logger):
    """Handles a simple one-off question and answer."""
    logger.info("--- Starting Single Turn Test ---")
    payload: dict[str, Any] = {
        "message": {
            "role": "user",
            "parts": [{"kind": "text", "text": "how much is 10 USD in INR?"}],
            "message_id": uuid4().hex,
        },
    }
    request = SendMessageRequest(id=str(uuid4()), params=MessageSendParams(**payload))

    response = await client.send_message(request)
    print("\n[Single Turn Response]:")
    print(response.model_dump_json(indent=2, exclude_none=True))


async def run_streaming(client: A2AClient, logger):
    """Handles a streaming."""

    logger.info("--- Starting Streaming Test ---")
    send_message_payload: dict[str, Any] = {
        "message": {
            "role": "user",
            "parts": [{"kind": "text", "text": "how much is 10 USD in INR?"}],
            "message_id": uuid4().hex,
        },
    }
    streaming_request = SendStreamingMessageRequest(
        id=str(uuid4()), params=MessageSendParams(**send_message_payload)
    )

    stream_response = client.send_message_streaming(streaming_request)

    # {'id': 'c96f2e32-2a20-491c-8501-79e6fcfeb9ef', 'jsonrpc': '2.0', 'result': {'contextId': 'bc6e34b3-d8ee-40de-9f4c-565c63c08db9', 'history': [{'contextId': 'bc6e34b3-d8ee-40de-9f4c-565c63c08db9', 'kind': 'message', 'messageId': '339e2e4d35f54d4b89475ffeabe9a7f1', 'parts': [{'kind': 'text', 'text': 'how much is 10 USD in INR?'}], 'role': 'user', 'taskId': '212b1753-2a54-48cb-9540-6c9f24098856'}], 'id': '212b1753-2a54-48cb-9540-6c9f24098856', 'kind': 'task', 'status': {'state': 'submitted'}}}
    # {'id': 'c96f2e32-2a20-491c-8501-79e6fcfeb9ef', 'jsonrpc': '2.0', 'result': {'contextId': 'bc6e34b3-d8ee-40de-9f4c-565c63c08db9', 'final': False, 'kind': 'status-update', 'status': {'message': {'contextId': 'bc6e34b3-d8ee-40de-9f4c-565c63c08db9', 'kind': 'message', 'messageId': 'f54a81d4-fee8-4abc-9a3e-fb472ee55378', 'parts': [{'kind': 'text', 'text': 'Looking up the exchange rates...'}], 'role': 'agent', 'taskId': '212b1753-2a54-48cb-9540-6c9f24098856'}, 'state': 'working', 'timestamp': '2025-12-18T07:36:01.543637+00:00'}, 'taskId': '212b1753-2a54-48cb-9540-6c9f24098856'}}
    # {'id': 'c96f2e32-2a20-491c-8501-79e6fcfeb9ef', 'jsonrpc': '2.0', 'result': {'contextId': 'bc6e34b3-d8ee-40de-9f4c-565c63c08db9', 'final': False, 'kind': 'status-update', 'status': {'message': {'contextId': 'bc6e34b3-d8ee-40de-9f4c-565c63c08db9', 'kind': 'message', 'messageId': 'a4bf5b39-6938-44b9-8d97-a14db8cc47b7', 'parts': [{'kind': 'text', 'text': 'Processing the exchange rates..'}], 'role': 'agent', 'taskId': '212b1753-2a54-48cb-9540-6c9f24098856'}, 'state': 'working', 'timestamp': '2025-12-18T07:36:01.638425+00:00'}, 'taskId': '212b1753-2a54-48cb-9540-6c9f24098856'}}
    # {'id': 'c96f2e32-2a20-491c-8501-79e6fcfeb9ef', 'jsonrpc': '2.0', 'result': {'artifact': {'artifactId': 'd9919875-73a8-4b36-8e63-f5c31e7729c5', 'name': 'conversion_result', 'parts': [{'kind': 'text', 'text': 'The current exchange rate is 1 USD = 90.37 INR. Therefore, 10 USD is equal to 903.7 INR.'}]}, 'contextId': 'bc6e34b3-d8ee-40de-9f4c-565c63c08db9', 'kind': 'artifact-update', 'taskId': '212b1753-2a54-48cb-9540-6c9f24098856'}}
    # {'id': 'c96f2e32-2a20-491c-8501-79e6fcfeb9ef', 'jsonrpc': '2.0', 'result': {'contextId': 'bc6e34b3-d8ee-40de-9f4c-565c63c08db9', 'final': True, 'kind': 'status-update', 'status': {'state': 'completed', 'timestamp': '2025-12-18T07:36:03.590538+00:00'}, 'taskId': '212b1753-2a54-48cb-9540-6c9f24098856'}}
    async for chunk in stream_response:
        print(chunk.model_dump(mode="json", exclude_none=True))


async def run_multiturn(client: A2AClient, logger):
    """Handles a back-and-forth conversation using context IDs."""
    logger.info("--- Starting Multiturn Test ---")

    # 1. First prompt
    first_payload: dict[str, Any] = {
        "message": {
            "role": "user",
            "parts": [
                {"kind": "text", "text": "How much is the exchange rate for 1 USD?"}
            ],
            "message_id": uuid4().hex,
        },
    }
    request = SendMessageRequest(
        id=str(uuid4()), params=MessageSendParams(**first_payload)
    )
    # {
    #   "id": "5eae8645-aade-48f9-9410-40e044ac4c17",
    #   "jsonrpc": "2.0",
    #   "result": {
    #     "contextId": "c4bd0ba3-e626-4bcf-b131-c14e8d9cba55",
    #     "history": [
    #       {
    #         "contextId": "c4bd0ba3-e626-4bcf-b131-c14e8d9cba55",
    #         "kind": "message",
    #         "messageId": "195bcb8be70a4032a644568848465570",
    #         "parts": [
    #           {
    #             "kind": "text",
    #             "text": "How much is the exchange rate for 1 USD?"
    #           }
    #         ],
    #         "role": "user",
    #         "taskId": "445c346d-49e4-484e-902c-c2a47b28647c"
    #       },
    #       {
    #         "contextId": "c4bd0ba3-e626-4bcf-b131-c14e8d9cba55",
    #         "kind": "message",
    #         "messageId": "c0bf4fd6-8431-4bcc-8406-7b68f8419563",
    #         "parts": [
    #           {
    #             "kind": "text",
    #             "text": "Looking up the exchange rates..."
    #           }
    #         ],
    #         "role": "agent",
    #         "taskId": "445c346d-49e4-484e-902c-c2a47b28647c"
    #       },
    #       {
    #         "contextId": "c4bd0ba3-e626-4bcf-b131-c14e8d9cba55",
    #         "kind": "message",
    #         "messageId": "6fcf7068-44c4-45dd-9071-751a98a07277",
    #         "parts": [
    #           {
    #             "kind": "text",
    #             "text": "Processing the exchange rates.."
    #           }
    #         ],
    #         "role": "agent",
    #         "taskId": "445c346d-49e4-484e-902c-c2a47b28647c"
    #       }
    #     ],
    #     "id": "445c346d-49e4-484e-902c-c2a47b28647c",
    #     "kind": "task",
    #     "status": {
    #       "message": {
    #         "contextId": "c4bd0ba3-e626-4bcf-b131-c14e8d9cba55",
    #         "kind": "message",
    #         "messageId": "55c9cd2d-d54c-4e65-955b-33e46a3b1cfa",
    #         "parts": [
    #           {
    #             "kind": "text",
    #             "text": "Please specify the currency you want to convert 1 USD into (e.g., EUR, GBP, JPY)."
    #           }
    #         ],
    #         "role": "agent",
    #         "taskId": "445c346d-49e4-484e-902c-c2a47b28647c"
    #       },
    #       "state": "input-required",
    #       "timestamp": "2025-12-18T07:11:24.881890+00:00"
    #     }
    #   }
    # }
    response = await client.send_message(request)

    # Please specify the currency you want to convert 1 USD into (e.g., EUR, GBP, JPY).
    print(response.model_dump(mode="json", exclude_none=True))

    task_id = response.root.result.id
    context_id = response.root.result.context_id

    # task_id: f7d7ae55-9b00-4309-8602-bf61a1f894e4 | context_id: f3c9fb63-631c-4062-ae41-88450fa2e170
    print(f"\n[First Turn Done] Task: {task_id} | Context: {context_id}")

    # 2. Follow-up prompt (providing the missing info the agent asked for)
    second_payload: dict[str, Any] = {
        "message": {
            "role": "user",
            "parts": [{"kind": "text", "text": "CAD"}],
            "message_id": uuid4().hex,
            "task_id": task_id,
            "context_id": context_id,
        },
    }
    second_request = SendMessageRequest(
        id=str(uuid4()), params=MessageSendParams(**second_payload)
    )

    # artifacts & status.completed marks that the agent response is complete
    second_response = await client.send_message(second_request)

    print("\n[Multiturn Final Response]:")
    # {
    #     'id': '2cdc12b7-9bea-4674-8fad-32dccb9119ed',
    #     'result': {
    #         'artifacts': [{
    #             'name': 'conversion_result',
    #             'text': 'The current exchange rate for 1 USD is approximately 1.379 CAD.'
    #         }],
    #         'history': [
    #             # ... (2 messages truncated: Agent looking up rates)
    #             {
    #                 'role': 'user',
    #                 'text': 'How much is the exchange rate for 1 USD?'
    #             },
    #             {
    #                 'role': 'agent',
    #                 'text': 'Could you please specify the currency you want to convert...'
    #             },
    #             {
    #                 'role': 'user',
    #                 'text': 'CAD'
    #             }
    #             # ... (2 messages truncated: Agent processing final result)
    #         ],
    #         'status': {
    #             'state': 'completed',
    #             'timestamp': '2025-12-18T07:22:31.801871+00:00'
    #         }
    #     }
    # }
    print(second_response.model_dump_json(indent=2, exclude_none=True))


if __name__ == "__main__":
    import asyncio

    asyncio.run(main())
