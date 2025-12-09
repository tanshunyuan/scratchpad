"""
Budget Agent (ADK + A2A Protocol)

This agent estimates travel costs and creates budgets using Google ADK.
It exposes an A2A Protocol endpoint so it can be called by the orchestrator.

Features:
- Estimates realistic travel budgets based on destination and duration
- Provides detailed cost breakdowns by category
- Considers cost of living and travel style preferences
- Returns structured JSON with budget analysis

Key Components:
- Google ADK (Agent Development Kit) for LLM integration
- A2A Protocol server for inter-agent communication
- Structured data models using Pydantic
- Google Gemini integration for budget calculations
- Financial analysis and cost estimation
"""

# Import necessary libraries for web server, JSON handling, and environment variables
import uvicorn
import os
import json
from typing import List
from dotenv import load_dotenv
from pydantic import BaseModel, Field

# Load environment variables from .env file (especially API keys)
load_dotenv()

# Import A2A Protocol components for inter-agent communication
from a2a.server.apps import A2AStarletteApplication
from a2a.server.request_handlers import DefaultRequestHandler
from a2a.server.tasks import InMemoryTaskStore
from a2a.types import (
    AgentCapabilities,
    AgentCard,
    AgentSkill,
)
from a2a.server.agent_execution import AgentExecutor, RequestContext
from a2a.server.events import EventQueue
from a2a.utils import new_agent_text_message

# Import Google ADK (Agent Development Kit) components for LLM integration
from google.adk.agents.llm_agent import LlmAgent
from google.adk.runners import Runner
from google.adk.sessions import InMemorySessionService
from google.adk.memory.in_memory_memory_service import InMemoryMemoryService
from google.adk.artifacts import InMemoryArtifactService
from google.genai import types


# === DATA MODELS ===
# These Pydantic models define the structure of our budget estimation data
# This ensures type safety and automatic validation of the generated content

class BudgetCategory(BaseModel):
    """Represents a single budget category with amount and percentage breakdown"""
    category: str = Field(description="Budget category name (e.g., Accommodation, Food)")
    amount: float = Field(description="Amount in USD")
    percentage: float = Field(description="Percentage of total budget")


class StructuredBudget(BaseModel):
    """Top-level model for the complete travel budget analysis"""
    totalBudget: float = Field(description="Total budget in USD")
    currency: str = Field(default="USD", description="Currency code")
    breakdown: List[BudgetCategory] = Field(description="Budget breakdown by category")
    notes: str = Field(description="Additional notes about the budget estimate")


# === MAIN AGENT CLASS ===
class BudgetAgent:
    """
    Main agent class that handles travel budget estimation using Google ADK.
    
    This agent uses Google's Agent Development Kit to:
    1. Create an LLM-powered agent with budget-specific instructions
    2. Process budget estimation requests for travel plans
    3. Return structured JSON responses with detailed cost breakdowns
    """
    
    def __init__(self):
        """Initialize the agent with Google ADK components and services"""
        # Build the core LLM agent with budget-specific instructions
        self._agent = self._build_agent()
        
        # Set up user identity for session management
        self._user_id = 'remote_agent'
        
        # Create the ADK runner that orchestrates the agent's execution
        # This includes session management, memory, and artifact storage
        self._runner = Runner(
            app_name=self._agent.name,
            agent=self._agent,
            artifact_service=InMemoryArtifactService(),  # For storing generated content
            session_service=InMemorySessionService(),    # For conversation history
            memory_service=InMemoryMemoryService(),      # For agent memory
        )

    def _build_agent(self) -> LlmAgent:
        """
        Create and configure the Google ADK LLM agent for budget estimation.
        
        This method:
        1. Gets the Gemini model name from environment variables
        2. Creates an LlmAgent with detailed budget estimation instructions
        3. Configures the agent to return structured JSON responses with cost breakdowns
        
        Returns:
            Configured LlmAgent instance ready for budget calculations
        """
        # Get Gemini model name from environment, default to flash model for speed
        model_name = os.getenv('GEMINI_MODEL', 'gemini-2.5-flash')

        return LlmAgent(
            model=model_name,
            name='budget_agent',
            description='An agent that estimates travel costs and creates detailed budget breakdowns',
            instruction="""
You are a travel budget planning agent. Your role is to estimate realistic travel budgets based on user requests.

When you receive a travel request, analyze the destination, duration, and any other details provided.
Then create a detailed budget breakdown in JSON format.

Return ONLY a valid JSON object with this exact structure:
{
  "totalBudget": 5000.00,
  "currency": "USD",
  "breakdown": [
    {
      "category": "Accommodation",
      "amount": 1500.00,
      "percentage": 30.0
    },
    {
      "category": "Food & Dining",
      "amount": 1000.00,
      "percentage": 20.0
    },
    {
      "category": "Transportation",
      "amount": 800.00,
      "percentage": 16.0
    },
    {
      "category": "Activities & Attractions",
      "amount": 1200.00,
      "percentage": 24.0
    },
    {
      "category": "Miscellaneous",
      "amount": 500.00,
      "percentage": 10.0
    }
  ],
  "notes": "Budget estimate based on mid-range travel for one person. Prices reflect average costs in the destination."
}

Make realistic estimates based on:
- The destination (cost of living in that location)
- Duration of the trip
- Type of travel (budget, mid-range, luxury if specified)
- Number of people if mentioned
- Any specific activities or requirements mentioned

Return ONLY valid JSON, no markdown code blocks, no other text.
            """,
            tools=[],  # No additional tools needed for this agent
        )

    async def invoke(self, query: str, session_id: str) -> str:
        """
        Main entry point for generating budget estimates.
        
        This method:
        1. Gets or creates a session for conversation continuity
        2. Formats the user query as ADK content
        3. Runs the agent to generate budget calculations
        4. Processes and validates the response
        5. Returns structured JSON with budget breakdown and analysis
        
        Args:
            query: User's budget estimation request
            session_id: Unique session identifier for conversation continuity
            
        Returns:
            JSON string containing structured budget breakdown and cost analysis
        """
        # Step 1: Get existing session or prepare to create new one
        session = await self._runner.session_service.get_session(
            app_name=self._agent.name,
            user_id=self._user_id,
            session_id=session_id,
        )

        # Step 2: Format user query as ADK content object
        content = types.Content(
            role='user', parts=[types.Part.from_text(text=query)]
        )

        # Step 3: Create new session if none exists
        if session is None:
            session = await self._runner.session_service.create_session(
                app_name=self._agent.name,
                user_id=self._user_id,
                state={},  # Empty initial state
                session_id=session_id,
            )

        # Step 4: Run the agent and collect response
        response_text = ''
        async for event in self._runner.run_async(
            user_id=self._user_id,
            session_id=session.id,
            new_message=content
        ):
            # Wait for the final response event
            if event.is_final_response():
                if (
                    event.content
                    and event.content.parts
                    and event.content.parts[0].text
                ):
                    # Combine all text parts into a single response
                    response_text = '\n'.join(
                        [p.text for p in event.content.parts if p.text]
                    )
                break

        # Step 5: Clean up the response content
        content_str = response_text.strip()

        # Remove markdown code blocks if present
        if "```json" in content_str:
            content_str = content_str.split("```json")[1].split("```")[0].strip()
        elif "```" in content_str:
            content_str = content_str.split("```")[1].split("```")[0].strip()

        # Step 6: Validate and structure the response
        try:
            # Parse JSON from LLM response
            structured_data = json.loads(content_str)
            
            # Validate structure using Pydantic model
            validated_budget = StructuredBudget(**structured_data)
            
            # Return formatted JSON string
            final_response = json.dumps(validated_budget.model_dump(), indent=2)
            print("✅ Successfully created structured budget")
            return final_response
            
        except json.JSONDecodeError as e:
            # Handle JSON parsing errors
            print(f"❌ JSON parsing error: {e}")
            print(f"Content: {content_str}")
            return json.dumps({
                "error": "Failed to generate structured budget",
                "raw_content": content_str[:200]  # Include first 200 chars for debugging
            })
        except Exception as e:
            # Handle Pydantic validation errors
            print(f"❌ Validation error: {e}")
            return json.dumps({
                "error": f"Validation failed: {str(e)}"
            })


# === A2A PROTOCOL CONFIGURATION ===
# Set up the agent to be discoverable and callable by other agents

# Get port from environment variable, default to 9002
port = int(os.getenv("BUDGET_PORT", 9002))

# Define the specific skill this agent provides
skill = AgentSkill(
    id='budget_agent',
    name='Budget Planning Agent',
    description='Estimates travel costs and creates detailed budget breakdowns using ADK',
    tags=['travel', 'budget', 'finance', 'adk'],
    examples=[
        'Estimate the budget for a 3-day trip to Tokyo',
        'How much would a week in Paris cost?',
        'Create a budget for my New York trip'
    ],
)

# Define the public agent card that other agents can discover
public_agent_card = AgentCard(
    name='Budget Agent',
    description='ADK-powered agent that estimates travel budgets and creates cost breakdowns',
    url=f'http://localhost:{port}/',
    version='1.0.0',
    defaultInputModes=['text'],      # Accepts text input
    defaultOutputModes=['text'],     # Returns text output
    capabilities=AgentCapabilities(streaming=True),  # Supports streaming responses
    skills=[skill],                  # List of skills this agent provides
    supportsAuthenticatedExtendedCard=False,  # No authentication required
)


# === A2A PROTOCOL EXECUTOR ===
class BudgetAgentExecutor(AgentExecutor):
    """
    Executor class that bridges A2A Protocol with our BudgetAgent.
    
    This class handles the A2A Protocol lifecycle:
    - Receives execution requests from other agents
    - Delegates to our BudgetAgent for processing
    - Sends results back through the event queue
    """
    
    def __init__(self):
        """Initialize the executor with an instance of our agent"""
        self.agent = BudgetAgent()

    async def execute(
        self,
        context: RequestContext,
        event_queue: EventQueue,
    ) -> None:
        """
        Execute a budget estimation request.
        
        This method:
        1. Extracts the user query from the request context
        2. Gets or generates a session ID for conversation continuity
        3. Calls our agent to generate budget estimates
        4. Sends the response through the A2A event queue
        
        Args:
            context: Request context containing the message and metadata
            event_queue: Queue for sending response events back to caller
        """
        # Extract user query from the request context
        query = context.get_user_input()
        
        # Get session ID for conversation continuity (fallback to default)
        session_id = getattr(context, 'context_id', 'default_session')
        
        # Generate budget estimate using our agent
        final_content = await self.agent.invoke(query, session_id)
        
        # Send result back through A2A Protocol event queue
        await event_queue.enqueue_event(new_agent_text_message(final_content))

    async def cancel(
        self, context: RequestContext, event_queue: EventQueue
    ) -> None:
        """
        Handle cancellation requests (not implemented).
        
        For this agent, we don't support cancellation since budget
        estimation is typically fast and non-interruptible.
        """
        raise Exception('cancel not supported')


# === MAIN APPLICATION SETUP ===
def main():
    """
    Main function that sets up and starts the A2A Protocol server.
    
    This function:
    1. Checks for required environment variables (API keys)
    2. Sets up the A2A Protocol request handler
    3. Creates the Starlette web application
    4. Starts the uvicorn server with detailed logging
    """
    
    # Check for required Google API key (either variant)
    if not os.getenv("GOOGLE_API_KEY") and not os.getenv("GEMINI_API_KEY"):
        print("⚠️  Warning: No API key found!")
        print("   Set either GOOGLE_API_KEY or GEMINI_API_KEY environment variable")
        print("   Example: export GOOGLE_API_KEY='your-key-here'")
        print("   Get a key from: https://aistudio.google.com/app/apikey")
        print()

    # Create the A2A Protocol request handler
    # This handles incoming requests and manages task lifecycle
    request_handler = DefaultRequestHandler(
        agent_executor=BudgetAgentExecutor(),  # Our custom executor
        task_store=InMemoryTaskStore(),        # Simple in-memory task storage
    )

    # Create the A2A Starlette web application
    # This provides the HTTP endpoints for A2A Protocol communication
    server = A2AStarletteApplication(
        agent_card=public_agent_card,           # Public agent information
        http_handler=request_handler,           # Request processing logic
        extended_agent_card=public_agent_card,  # Extended agent info (same as public)
    )

    # Start the server with detailed information
    print(f"💰 Starting Budget Agent (ADK + A2A) on http://localhost:{port}")
    print(f"   Agent: {public_agent_card.name}")
    print(f"   Description: {public_agent_card.description}")
    uvicorn.run(server.build(), host='0.0.0.0', port=port)


# === ENTRY POINT ===
if __name__ == '__main__':
    """
    Entry point when script is run directly.
    
    This allows the agent to be started as a standalone service:
    python budget_agent.py
    """
    main()
