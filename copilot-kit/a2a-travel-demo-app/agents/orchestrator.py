"""
Orchestrator Agent (ADK + AG-UI Protocol)

This agent receives user requests via AG-UI Protocol and delegates tasks
to specialized A2A agents (Itinerary and Budget agents).

The A2A middleware in the frontend will wrap this agent and give it the
send_message_to_a2a_agent tool to communicate with other agents.

Key Components:
- Google ADK (Agent Development Kit) for LLM integration
- AG-UI Protocol for frontend communication
- A2A Protocol for inter-agent communication via middleware
- FastAPI web server for HTTP endpoints
- Centralized orchestration logic for travel planning workflow

Architecture:
- Acts as the main coordinator for all travel planning tasks
- Delegates specialized tasks to domain-specific agents
- Manages workflow state and inter-agent communication
- Provides human-in-the-loop interactions for critical decisions
"""

# Enable future annotations for forward compatibility
from __future__ import annotations

# Load environment variables from .env file before other imports
from dotenv import load_dotenv

load_dotenv()

# Import necessary libraries for web server and environment variables
import os

import uvicorn

# Import AG-UI ADK components for frontend integration
from ag_ui_adk import ADKAgent, add_adk_fastapi_endpoint

# Import FastAPI for creating HTTP endpoints
from fastapi import FastAPI

# Import Google ADK components for LLM agent creation
from google.adk.agents import LlmAgent

# === ORCHESTRATOR AGENT CONFIGURATION ===
# Create the main orchestrator agent using Google ADK's LlmAgent
# This agent coordinates all travel planning activities and manages the workflow

# @note - this is just a llm call, not sure why its called an agent. when it does not have access to state nor memory
orchestrator_agent = LlmAgent(
    name="OrchestratorAgent",
    # model="gemini-2.5-pro",  # Use the more powerful Pro model for complex orchestration
    model="gemini-2.5-flash",  # Use the more powerful Pro model for complex orchestration
    instruction="""
    You are a travel planning orchestrator agent. Your role is to coordinate specialized agents
    to create personalized travel plans.

    AVAILABLE SPECIALIZED AGENTS:

    1. **Itinerary Agent** (LangGraph) - Creates day-by-day travel itineraries with activities
    2. **Restaurant Agent** (LangGraph) - Recommends restaurants for breakfast, lunch, and dinner by day
    3. **Weather Agent** (ADK) - Provides weather forecasts and packing advice
    4. **Budget Agent** (ADK) - Estimates travel costs and creates budget breakdowns

    CRITICAL CONSTRAINTS:
    - You MUST call agents ONE AT A TIME, never make multiple tool calls simultaneously
    - After making a tool call, WAIT for the result before making another tool call
    - Do NOT make parallel/concurrent tool calls - this is not supported

    RECOMMENDED WORKFLOW FOR TRAVEL PLANNING:

    0. **FIRST STEP - Gather Trip Requirements**:
       - Before doing ANYTHING else, call 'gather_trip_requirements' to collect essential trip information
       - Try to extract any mentioned details from the user's message (city, days, people, budget level)
       - Pass any extracted values as parameters to pre-fill the form:
         * city: Extract destination city if mentioned (e.g., "Paris", "Tokyo")
         * numberOfDays: Extract if mentioned (e.g., "5 days", "a week")
         * numberOfPeople: Extract if mentioned (e.g., "2 people", "family of 4")
         * budgetLevel: Extract if mentioned (e.g., "budget", "luxury") -> map to Economy/Comfort/Premium
       - Wait for the user to submit the complete requirements
       - Use the returned values for all subsequent agent calls

    1. **Itinerary Agent** - Create the base itinerary using trip requirements
       - Pass: city, numberOfDays from trip requirements
       - Wait for structured JSON response with day-by-day activities
       - Note: Meals section will be empty initially

    2. **Weather Agent** - Get weather forecast
       - Pass: city and numberOfDays from trip requirements
       - Wait for forecast with daily conditions and packing advice
       - This helps inform activity planning

    3. **Restaurant Agent** - Get meal recommendations
       - Pass: city and numberOfDays from trip requirements
       - Request day-by-day meal recommendations (breakfast, lunch, dinner)
       - Wait for structured JSON with meals matching the itinerary days
       - These will populate the meals section in the itinerary display

    4. **Budget Agent** - Create comprehensive cost estimate
       - Pass: city, numberOfDays, numberOfPeople, budgetLevel from trip requirements
       - Wait for detailed budget breakdown
       - This requires user approval via the request_budget_approval tool

    IMPORTANT WORKFLOW DETAILS:
    - ALWAYS START by calling 'gather_trip_requirements' FIRST before any agent calls
    - The Itinerary Agent creates the structure but leaves meals empty
    - The Restaurant Agent fills in the meals section with specific recommendations
    - The Weather Agent provides context for outdoor activities and what to pack
    - The Budget Agent runs last and requires human-in-the-loop approval

    TRIP REQUIREMENTS EXTRACTION EXAMPLES:
    - "Plan a trip to Paris" -> call gather_trip_requirements with city: "Paris"
    - "5 day trip to Tokyo for 2 people" -> city: "Tokyo", numberOfDays: 5, numberOfPeople: 2
    - "Budget vacation to Bali" -> city: "Bali", budgetLevel: "Economy"
    - "Luxury 3-day getaway for my family of 4" -> numberOfDays: 3, numberOfPeople: 4, budgetLevel: "Premium"
    - "Plan a trip to New York" -> city: "New York"
    - "I want to visit Rome for a week" -> city: "Rome", numberOfDays: 7

    RESPONSE STRATEGY:
    - After each agent response, briefly acknowledge what you received
    - Build up the travel plan incrementally as you gather information
    - At the end, present a complete, well-organized travel plan
    - Don't just list agent responses - synthesize them into a cohesive plan

    IMPORTANT: Once you have received a response from an agent, do NOT call that same
    agent again for the same information. Use the information you already have.
    """,
)

# === AG-UI PROTOCOL INTEGRATION ===
# Wrap the orchestrator agent with AG-UI Protocol capabilities
# This enables frontend communication and provides the interface for user interactions

# @note - ADKAgent: from AG-UI; LlmAgent: from ADK
adk_orchestrator_agent = ADKAgent(
    adk_agent=orchestrator_agent,  # The core LLM agent we created above
    app_name="orchestrator_app",  # Unique application identifier
    user_id="demo_user",  # Default user ID for demo purposes
    session_timeout_seconds=3600,  # Session timeout (1 hour)
    use_in_memory_services=True,  # Use in-memory storage for simplicity
)

# === FASTAPI WEB APPLICATION SETUP ===
# Create the FastAPI application that will serve the orchestrator agent
# This provides HTTP endpoints for the AG-UI Protocol communication

app = FastAPI(title="Travel Planning Orchestrator (ADK)")

# Add the ADK agent endpoint to the FastAPI application
# This creates the necessary routes for AG-UI Protocol communication
add_adk_fastapi_endpoint(app, adk_orchestrator_agent, path="/")

# === MAIN APPLICATION ENTRY POINT ===
if __name__ == "__main__":
    """
    Main entry point when the script is run directly.

    This function:
    1. Checks for required environment variables (API keys)
    2. Configures the server port
    3. Starts the uvicorn server with the FastAPI application
    """

    # Check for required Google API key
    if not os.getenv("GOOGLE_API_KEY"):
        print("⚠️  Warning: GOOGLE_API_KEY environment variable not set!")
        print("   Set it with: export GOOGLE_API_KEY='your-key-here'")
        print("   Get a key from: https://aistudio.google.com/app/apikey")
        print()

    # Get server port from environment variable, default to 9000
    port = int(os.getenv("ORCHESTRATOR_PORT", 9000))

    # Start the server with detailed information
    print(f"🚀 Starting Orchestrator Agent (ADK + AG-UI) on http://localhost:{port}")

    # Run the FastAPI application using uvicorn
    # host="0.0.0.0" allows external connections
    # port is configurable via environment variable
    uvicorn.run(app, host="0.0.0.0", port=port)
