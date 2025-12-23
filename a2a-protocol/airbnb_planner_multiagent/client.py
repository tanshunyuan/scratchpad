import asyncio
import traceback  # Import the traceback module
from collections.abc import AsyncIterator
from pprint import pformat

import gradio as gr
from google.adk.events import Event
from google.adk.runners import Runner
from google.adk.sessions import InMemorySessionService
from google.genai import types

# from routing_agent import (
#     root_agent as routing_agent,
# )


APP_NAME = "routing_app"
USER_ID = "default_user"
SESSION_ID = "default_session"

SESSION_SERVICE = InMemorySessionService()
# ROUTING_AGENT_RUNNER = Runner(
#     agent=routing_agent,
#     app_name=APP_NAME,
#     session_service=SESSION_SERVICE,
# )


async def main():
    """Main gradio app."""
    print("Creating ADK session...")
    await SESSION_SERVICE.create_session(
        app_name=APP_NAME, user_id=USER_ID, session_id=SESSION_ID
    )
    print("ADK session created successfully.")

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
        # gr.ChatInterface(
        #     get_response_from_agent,
        #     title='A2A Host Agent',
        #     description='This assistant can help you to check weather and find airbnb accommodation',
        # )

        # def yes(message, history):
        #     return "yes"

        # gr.ChatInterface(
        #     fn=yes,
        #     title="A2A Host Agent",
        #     description="This assistant can help you to check weather and find airbnb accommodation",
        # )

    print("Launching Gradio interface...")
    demo.queue().launch(
        server_name="0.0.0.0",
        server_port=8083,
    )
    print("Gradio application has been shut down.")


if __name__ == "__main__":
    asyncio.run(main())
