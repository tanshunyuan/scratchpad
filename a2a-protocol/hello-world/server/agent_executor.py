# This file defines how a agent process request and generate responses

from a2a.server.agent_execution import AgentExecutor, RequestContext
from a2a.server.events import EventQueue
from a2a.utils import new_agent_text_message


# Dummy agent
class HelloWorldAgent:
    """Hello World Agent."""

    async def invoke(self) -> str:
        return "Hello World"


class HelloWorldAgentExecutor(AgentExecutor):
    def __init__(self):
        self.agent = HelloWorldAgent()

    # Handles incoming requests,
    # user input comes from `context`
    # uses `event_queue` to send back response (Message, Task, TaskStatusUpdateEvent or TaskArtifactUpdateEvent)
    async def execute(self, context: RequestContext, event_queue: EventQueue) -> None:
        result = await self.agent.invoke()
        text_msg = new_agent_text_message(result)
        await event_queue.enqueue_event(text_msg)

    async def cancel(self, context: RequestContext, event_queue: EventQueue) -> None:
        raise Exception("cancel not supported")
