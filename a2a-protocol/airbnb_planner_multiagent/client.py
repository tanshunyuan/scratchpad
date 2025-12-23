import asyncio
import traceback  # Import the traceback module
from collections.abc import AsyncIterator
from pprint import pformat
from loguru import logger

import gradio as gr
from google.adk.events import Event
from google.adk.runners import Runner
from google.adk.sessions import InMemorySessionService
from google.genai import types

from agents.routing_agent.routing_agent import (
    root_agent as routing_agent
)
from dotenv import load_dotenv
import sys

logger.remove()
logger.add(sys.stderr, level="TRACE")

load_dotenv()

APP_NAME = "routing_app"
USER_ID = "default_user"
SESSION_ID = "default_session"

SESSION_SERVICE = InMemorySessionService()
ROUTING_AGENT_RUNNER = Runner(
    agent=routing_agent,
    app_name=APP_NAME,
    session_service=SESSION_SERVICE,
)

async def get_response_from_agent(
    message: str,
    history: list[gr.ChatMessage]
) -> AsyncIterator[gr.ChatMessage]:
    """Get response from host agent"""

    # message:what agent do you haves?
    # history:[{'role': 'user', 'metadata': None, 'content': [{'text': 'hi', 'type': 'text'}], 'options': None}, {'role': 'assistant', 'metadata': {}, 'content': [{'text': 'Hello! How can I help you today?', 'type': 'text'}], 'options': []}]
    logger.trace(f'\nmessage:{message}\nhistory:{history}\n')
    try:
        # This invokes the routing agent, with the initial message sent from the client
        event_iterator: AsyncIterator[Event] = ROUTING_AGENT_RUNNER.run_async(
            user_id=USER_ID,
            session_id=SESSION_ID,
            new_message=types.Content(
                role='user', parts=[types.Part(text=message)]
            ),
        )

        async for event in event_iterator:
            logger.trace(event.content)
            logger.trace(event.is_final_response())

            if event.is_final_response():
                final_response_text = ''
                if event.content and event.content.parts:
                    # [Part( text='Hi there! How can I help you today?' )]
                    final_response_text = ''.join(
                        [p.text for p in event.content.parts if p.text]
                    )
                elif event.actions and event.actions.escalate:
                    final_response_text = f'Agent escalated: {event.error_message or "No specific message."}'
                if final_response_text:
                    yield gr.ChatMessage(
                        role='assistant', content=final_response_text
                    )
                break

            if event.content and event.content.parts:
                for part in event.content.parts:
                    # Part(
                    #   function_call=FunctionCall(
                    #     args={
                    #       'agent_name': 'Weather Agent',
                    #       'task': 'Get the weather forecast for Singapore.'
                    #     },
                    #     id='adk-3e318d10-6a6e-428a-b46e-55c8bedc3cd2',
                    #     name='send_message'
                    #   )
                    # )
                    if part.function_call:
                        formatted_call = f'```python\n{pformat(part.function_call.model_dump(exclude_none=True), indent=2, width=80)}\n```'
                        yield gr.ChatMessage(
                            role='assistant',
                            content=f'🛠️ **Tool Call: {part.function_call.name}**\n{formatted_call}',
                        )
                    elif part.function_response:
                        response_content = part.function_response.response
                        if (
                            isinstance(response_content, dict)
                            and 'response' in response_content
                        ):
                            formatted_response_data = response_content[
                                'response'
                            ]
                        else:
                            formatted_response_data = response_content
                        formatted_response = f'```json\n{pformat(formatted_response_data, indent=2, width=80)}\n```'
                        yield gr.ChatMessage(
                            role='assistant',
                            content=f'⚡ **Tool Response from {part.function_response.name}**\n{formatted_response}',
                        )

    except Exception as e:
        logger.error(f'Error in get_response_from_agent (Type: {type(e)}): {e}')
        traceback.print_exc()  # This will print the full traceback
        yield gr.ChatMessage(
            role='assistant',
            content='An error occurred while processing your request. Please check the server logs for details.',
        )



# async def main():
#     """Main gradio app."""

#     logger.trace("Creating ADK session...")
#     await SESSION_SERVICE.create_session(
#         app_name=APP_NAME, user_id=USER_ID, session_id=SESSION_ID
#     )
#     logger.trace("ADK session created successfully.")

#     with gr.Blocks(theme=gr.themes.Ocean(), title="A2A Host Agent with Logo") as demo:
#         gr.Image(
#             "https://a2a-protocol.org/latest/assets/a2a-logo-black.svg",
#             width=100,
#             height=100,
#             scale=0,
#             show_label=False,
#             # show_download_button=False,
#             container=False,
#             # show_fullscreen_button=False,
#         )
#         gr.ChatInterface(
#             get_response_from_agent,
#             title='A2A Host Agent',
#             description='This assistant can help you to check weather and find airbnb accommodation',
#         )


#     logger.trace("Launching Gradio interface...")
#     demo.queue().launch(
#         server_name="0.0.0.0",
#         server_port=8083,
#     )
#     logger.trace("Gradio application has been shut down.")


async def create_adk_session():
    logger.trace("Creating ADK session...")
    await SESSION_SERVICE.create_session(
        app_name=APP_NAME, user_id=USER_ID, session_id=SESSION_ID
    )
    logger.trace("ADK session created successfully.")

asyncio.run(create_adk_session())

with gr.Blocks(theme=gr.themes.Ocean(), title="A2A Host Agent with Logo") as demo:
    gr.Image(
        "https://a2a-protocol.org/latest/assets/a2a-logo-black.svg",
        width=100,
        height=100,
        scale=0,
        show_label=False,
        # show_download_button=False,
        container=False,
        # show_fullscreen_button=False,
    )
    gr.ChatInterface(
        get_response_from_agent,
        title='A2A Host Agent',
        description='This assistant can help you to check weather and find airbnb accommodation',
    )

if __name__ == "__main__":
    logger.trace("Launching Gradio interface...")
    demo.queue().launch(
        server_name="0.0.0.0",
        server_port=8083,
    )
    logger.trace("Gradio application has been shut down.")
