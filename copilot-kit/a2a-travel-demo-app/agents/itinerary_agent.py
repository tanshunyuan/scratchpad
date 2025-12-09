"""
Itinerary Agent (LangGraph + A2A Protocol)

This agent creates day-by-day travel itineraries using LangGraph.
It exposes an A2A Protocol endpoint so it can be called by the orchestrator.

Key Components:
- LangGraph workflow for itinerary generation
- A2A Protocol server for inter-agent communication
- Structured data models using Pydantic
- OpenAI GPT-4 integration for content generation
"""

# Import necessary libraries for web server, JSON handling, and environment variables
import json
import os

import uvicorn
from dotenv import load_dotenv

# Load environment variables from .env file (especially OPENAI_API_KEY)
load_dotenv()

# Import A2A Protocol components for inter-agent communication
# Import Python typing and data validation libraries
from typing import List, Optional, TypedDict

from a2a.server.agent_execution import AgentExecutor, RequestContext
from a2a.server.apps import A2AStarletteApplication
from a2a.server.events import EventQueue
from a2a.server.request_handlers import DefaultRequestHandler
from a2a.server.tasks import InMemoryTaskStore
from a2a.types import AgentCapabilities, AgentCard, AgentSkill, Message
from a2a.utils import new_agent_text_message

# Import OpenAI integration for LLM capabilities
from langchain_openai import ChatOpenAI

# Import LangGraph components for workflow management
from langgraph.graph import END, START, StateGraph
from pydantic import BaseModel, Field

# === DATA MODELS ===


class ItineraryState(TypedDict):
    """State object that flows through the LangGraph workflow

    This maintains the data as it moves through different processing steps:
    - destination: Extracted travel destination
    - days: Number of days for the trip
    - message: Original user request
    - itinerary: Final formatted itinerary as JSON string
    - structured_itinerary: Validated itinerary data as dictionary
    """

    destination: str
    days: int
    message: str
    itinerary: str
    structured_itinerary: Optional[dict]


# === MAIN AGENT CLASS ===
class ItineraryAgent:
    """
    Main agent class that handles itinerary generation using LangGraph workflow.

    This agent uses a two-step process:
    1. Parse the user request to extract destination and duration
    2. Generate a detailed structured itinerary using OpenAI
    """

    def __init__(self):
        """Initialize the agent with OpenAI LLM and build the workflow graph"""
        # Initialize OpenAI client with GPT-4o-mini for cost efficiency
        # Temperature 0.7 provides creative but still focused responses
        self.llm = ChatOpenAI(model="gpt-4o-mini", temperature=0.7)

        # Build and compile the LangGraph workflow
        self.graph = self._build_graph()

    def _build_graph(self):
        """
        Create the LangGraph workflow with two sequential steps:
        1. parse_request: Extract destination and days from user input
        2. create_itinerary: Generate detailed itinerary based on extracted info
        """
        # Create a new state graph with our custom state type
        workflow = StateGraph(ItineraryState)

        # Add nodes for each step in our workflow
        workflow.add_node("parse_request", self._parse_request)
        workflow.add_node("create_itinerary", self._create_itinerary)

        # Define the workflow flow: start with parsing, then create itinerary
        workflow.add_edge(START, "parse_request")
        workflow.add_edge("parse_request", "create_itinerary")
        workflow.add_edge("create_itinerary", END)

        # Compile the workflow into an executable graph
        return workflow.compile()

    def _parse_request(self, state: ItineraryState) -> ItineraryState:
        """
        First step: Parse user request to extract destination and trip duration.

        This function uses LLM to intelligently extract structured information
        from natural language travel requests.

        Args:
            state: Current workflow state containing the user message

        Returns:
            Updated state with extracted destination and days
        """
        message = state["message"]

        # Create a focused prompt for extraction task
        prompt = f"""
        Extract the destination and number of days from this travel request.
        Return ONLY a JSON string with 'destination' and 'days' fields.

        Request: {message}

        Example output: {{"destination": "Tokyo", "days": 3}}
        """

        class ExtractDestinationsAndDays(BaseModel):
            """Format to retrive destinations and days from a list of messages"""

            destination: str = Field(..., description="The destination of the trip")
            days: int = Field(..., description="The number of days for the trip")

        llm_with_structure = self.llm.with_structured_output(ExtractDestinationsAndDays)

        try:
            response = llm_with_structure.invoke(prompt)
            print(response)

            if isinstance(response, dict):
                validated_data = ExtractDestinationsAndDays(**response)
            else:
                validated_data = response

            print(f"📍 Extracted: {validated_data}")

            # Attempt to parse the JSON response
            state["destination"] = validated_data.destination
            state["days"] = validated_data.days
        except Exception as e:
            print(f"⚠️  Failed to parse request: {e}, using defaults")
            state["destination"] = "Unknown"
            state["days"] = 3

        return state

    def _create_itinerary(self, state: ItineraryState) -> ItineraryState:
        """
        Second step: Generate detailed day-by-day itinerary.

        This function creates a comprehensive travel plan with:
        - Morning, afternoon, and evening activities for each day
        - Specific locations and recommendations
        - Meal suggestions with restaurant names
        - Structured JSON output with data validation

        Args:
            state: Current workflow state with destination and days

        Returns:
            Updated state with complete itinerary in both JSON and structured formats
        """
        destination = state["destination"]
        days = state["days"]

        # Create detailed prompt for itinerary generation
        prompt = f"""
        Create a detailed {days}-day travel itinerary for {destination}.

        For each day, include:
        - A descriptive title/theme for the day
        - Morning activities with 2-3 specific things to do and the main area/neighborhood
        - Afternoon activities with 2-3 specific things to do and the main area/neighborhood
        - Evening activities with 2-3 specific things to do and the main area/neighborhood
        - Breakfast, lunch, and dinner recommendations with specific restaurant names and signature dishes

        Make it realistic, interesting, and include specific place names and neighborhoods.
        Ensure activities are appropriate for the time of day and logically flow throughout the day.
        """

        class TimeOfDay(BaseModel):
            """Activities and location for a specific time of day"""

            activities: List[str] = Field(
                ..., description="List of 2-3 activities for this time period"
            )
            location: str = Field(
                ..., description="Main area or neighborhood for these activities"
            )

        class Meals(BaseModel):
            """Meal recommendations for the day"""

            breakfast: str = Field(
                ..., description="Restaurant name and recommended dish"
            )
            lunch: str = Field(..., description="Restaurant name and recommended dish")
            dinner: str = Field(..., description="Restaurant name and recommended dish")

        class DayItinerary(BaseModel):
            """Complete itinerary for a single day"""

            day: int = Field(..., description="Day number (1, 2, 3, etc.)")
            title: str = Field(..., description="Theme or title for the day")
            morning: TimeOfDay
            afternoon: TimeOfDay
            evening: TimeOfDay
            meals: Meals

        class StructuredItinerary(BaseModel):
            """Complete travel itinerary with all days"""

            destination: str = Field(..., description="The destination of the trip")
            days: int = Field(..., description="Number of days in the itinerary")
            itinerary: List[DayItinerary] = Field(
                ..., description="Day-by-day itinerary"
            )

        llm_with_structure = self.llm.with_structured_output(StructuredItinerary)

        try:
            response = llm_with_structure.invoke(prompt)

            if isinstance(response, dict):
                validated_itinerary = StructuredItinerary(**response)
            else:
                validated_itinerary = response

            state["structured_itinerary"] = validated_itinerary.model_dump()
            state["itinerary"] = json.dumps(validated_itinerary.model_dump(), indent=2)

            print("✅ Successfully created structured itinerary")

        except Exception as e:
            # Handle any validation or generation errors
            print(f"❌ Failed to generate itinerary: {e}")

            # Create fallback itinerary structure
            fallback_itinerary = {
                "destination": destination,
                "days": days,
                "itinerary": [],
                "error": f"Failed to generate itinerary: {str(e)}",
            }

            state["structured_itinerary"] = fallback_itinerary
            state["itinerary"] = json.dumps(fallback_itinerary, indent=2)

        return state

    async def invoke(self, message: Message) -> str:
        """
        Main entry point for the agent when called via A2A Protocol.

        This method:
        1. Extracts text from the A2A message
        2. Runs the LangGraph workflow
        3. Returns the generated itinerary as a JSON string

        Args:
            message: A2A Protocol message containing the travel request

        Returns:
            JSON string containing the complete itinerary
        """
        # Extract text content from A2A message format
        message_text = message.parts[0].root.text
        print("Invoking itinerary agent with message: ", message_text)

        # Execute the LangGraph workflow with initial state
        result = self.graph.invoke(
            {
                "message": message_text,
                "destination": "",  # Will be populated by parse_request
                "days": 3,  # Default, will be updated by parse_request
                "itinerary": "",  # Will be populated by create_itinerary
            }
        )

        # Return the final itinerary JSON string
        return result["itinerary"]


# === A2A PROTOCOL CONFIGURATION ===
# Set up the agent to be discoverable and callable by other agents

# Get port from environment variable, default to 9001
port = int(os.getenv("ITINERARY_PORT", 9001))

# Define the specific skill this agent provides
skill = AgentSkill(
    id="itinerary_agent",
    name="Itinerary Planning Agent",
    description="Creates detailed day-by-day travel itineraries using LangGraph",
    tags=["travel", "itinerary", "langgraph"],
    examples=[
        "Create a 3-day itinerary for Tokyo",
        "Plan a week-long trip to Paris",
        "What should I do in New York for 5 days?",
    ],
)

# Define the public agent card that other agents can discover
public_agent_card = AgentCard(
    name="Itinerary Agent",
    description="LangGraph-powered agent that creates detailed day-by-day travel itineraries in plain text format with activities and meal recommendations.",
    url=f"http://localhost:{port}/",
    version="1.0.0",
    defaultInputModes=["text"],  # Accepts text input
    defaultOutputModes=["text"],  # Returns text output
    capabilities=AgentCapabilities(streaming=True),  # Supports streaming responses
    skills=[skill],  # List of skills this agent provides
    supportsAuthenticatedExtendedCard=False,  # No authentication required
)


# === A2A PROTOCOL EXECUTOR ===
class ItineraryAgentExecutor(AgentExecutor):
    """
    Executor class that bridges A2A Protocol with our ItineraryAgent.

    This class handles the A2A Protocol lifecycle:
    - Receives execution requests from other agents
    - Delegates to our ItineraryAgent for processing
    - Sends results back through the event queue
    """

    def __init__(self):
        """Initialize the executor with an instance of our agent"""
        self.agent = ItineraryAgent()

    async def execute(
        self,
        context: RequestContext,
        event_queue: EventQueue,
    ) -> None:
        """
        Execute an itinerary generation request.

        This method:
        1. Calls our agent with the incoming message
        2. Formats the result as an A2A text message
        3. Sends the response through the event queue

        Args:
            context: Request context containing the message and metadata
            event_queue: Queue for sending response events back to caller
        """
        # Generate itinerary using our agent
        result = await self.agent.invoke(context.message)

        # Send result back through A2A Protocol event queue
        await event_queue.enqueue_event(new_agent_text_message(result))

    async def cancel(self, context: RequestContext, event_queue: EventQueue) -> None:
        """
        Handle cancellation requests (not implemented).

        For this agent, we don't support cancellation since itinerary
        generation is typically fast and non-interruptible.
        """
        raise Exception("cancel not supported")


# === MAIN APPLICATION SETUP ===
def main():
    """
    Main function that sets up and starts the A2A Protocol server.

    This function:
    1. Checks for required environment variables
    2. Sets up the A2A Protocol request handler
    3. Creates the Starlette web application
    4. Starts the uvicorn server
    """

    # Check for required OpenAI API key
    if not os.getenv("OPENAI_API_KEY"):
        print("⚠️  Warning: OPENAI_API_KEY environment variable not set!")
        print("   Set it with: export OPENAI_API_KEY='your-key-here'")
        print()

    # Create the A2A Protocol request handler
    # This handles incoming requests and manages task lifecycle
    request_handler = DefaultRequestHandler(
        agent_executor=ItineraryAgentExecutor(),  # Our custom executor
        task_store=InMemoryTaskStore(),  # Simple in-memory task storage
    )

    # Create the A2A Starlette web application
    # This provides the HTTP endpoints for A2A Protocol communication
    server = A2AStarletteApplication(
        agent_card=public_agent_card,  # Public agent information
        http_handler=request_handler,  # Request processing logic
        extended_agent_card=public_agent_card,  # Extended agent info (same as public)
    )

    # Start the server
    print(f"🗺️  Starting Itinerary Agent (LangGraph + A2A) on http://localhost:{port}")
    uvicorn.run(server.build(), host="0.0.0.0", port=port)


# === ENTRY POINT ===
if __name__ == "__main__":
    """
    Entry point when script is run directly.

    This allows the agent to be started as a standalone service:
    python itinerary_agent.py
    """
    main()
