"use client";

/**
 * Travel Chat Component - CopilotKit Feature Showcase
 *
 * This component demonstrates advanced CopilotKit patterns for AI-powered applications:
 *
 * A2A (Agent-to-Agent) Communication:
 *     - Visualizes real-time message exchanges between orchestrator and specialized agents
 *     - Uses custom UI components to show bidirectional communication flow
 *
 * HITL (Human-in-the-Loop) Workflows:
 *     - Trip requirements form: Collects user preferences before agent execution
 *     - Budget approval: Pauses agent workflow until user approves/rejects budget
 *
 * Generative UI:
 *     - Automatically extracts and renders structured data from agent responses
 *     - Creates interactive components (weather cards, budget breakdowns) from AI outputs
 *
 * Multi-Agent Architecture:
 *     - Coordinates 4 specialized agents (itinerary, budget, weather, restaurant)
 *     - Uses LangGraph backend with Agent Development Kit (ADK) via A2A Protocol
 */

import React, { useState, useEffect } from "react";
// Core CopilotKit imports for chat functionality and action handling
import { CopilotKit, useCopilotChat } from "@copilotkit/react-core";
import { CopilotChat } from "@copilotkit/react-ui";
import { useCopilotAction } from "@copilotkit/react-core";
import "@copilotkit/react-ui/styles.css";
import "./style.css";
// Type definitions for component props and data structures
import type {
  TravelChatProps,
  ItineraryData,
  BudgetData,
  WeatherData,
  RestaurantData,
  MessageActionRenderProps,
} from "./types";
// A2A Communication visualization components
import { MessageToA2A } from "./a2a/MessageToA2A";
import { MessageFromA2A } from "./a2a/MessageFromA2A";
// HITL (Human-in-the-Loop) form components
import { TripRequirementsForm } from "./forms/TripRequirementsForm";
import { BudgetApprovalCard } from "./hitl/BudgetApprovalCard";
// Generative UI components for displaying structured data
import { WeatherCard } from "./WeatherCard";

/**
 * Inner Chat Component - Contains all CopilotKit feature implementations
 * This component must be wrapped by CopilotKit provider to access context
 */
const ChatInner = ({
  onItineraryUpdate,
  onBudgetUpdate,
  onWeatherUpdate,
  onRestaurantUpdate,
}: TravelChatProps) => {
  // State management for HITL budget approval workflow
  // Tracks approval/rejection status for different budget proposals
  const [approvalStates, setApprovalStates] = useState<
    Record<string, { approved: boolean; rejected: boolean }>
  >({});

  // CopilotKit hook to access chat messages for data extraction
  // visibleMessages contains all messages currently displayed in the chat
  const { visibleMessages } = useCopilotChat();

  /**
   * GENERATIVE UI FEATURE: Auto-extract structured data from agent responses
   *
   * This useEffect demonstrates CopilotKit's ability to automatically parse and
   * extract structured data from AI agent responses, converting them into
   * interactive UI components.
   *
   * Process:
   * 1. Monitor all visible chat messages for agent responses
   * 2. Parse JSON data from A2A agent message results
   * 3. Identify data type (itinerary, budget, weather, restaurant)
   * 4. Update parent component state to render corresponding UI components
   * 5. Apply business logic (e.g., budget approval checks)
   */
  useEffect(() => {
    const extractDataFromMessages = () => {
      // Step 1: Iterate through all visible messages in the chat
      for (const message of visibleMessages) {
        const msg = message as any;

        // Step 2: Filter for A2A agent response messages specifically
        if (
          msg.type === "ResultMessage" &&
          msg.actionName === "send_message_to_a2a_agent"
        ) {
          try {
            const result = msg.result;
            let parsed;

            // Step 3: Parse the agent response data (handle both string and object formats)
            if (typeof result === "string") {
              let cleanResult = result;
              // Remove A2A protocol prefix if present
              if (result.startsWith("A2A Agent Response: ")) {
                cleanResult = result.substring("A2A Agent Response: ".length);
              }
              parsed = JSON.parse(cleanResult);
            } else if (typeof result === "object" && result !== null) {
              parsed = result;
            }

            // Step 4: Identify data type and trigger appropriate UI updates
            if (parsed) {
              // Itinerary data: destination + itinerary array
              if (
                parsed.destination &&
                parsed.itinerary &&
                Array.isArray(parsed.itinerary)
              ) {
                onItineraryUpdate?.(parsed as ItineraryData);
              }
              // Budget data: requires user approval before displaying
              else if (
                parsed.totalBudget &&
                parsed.breakdown &&
                Array.isArray(parsed.breakdown)
              ) {
                const budgetKey = `budget-${parsed.totalBudget}`;
                const isApproved = approvalStates[budgetKey]?.approved || false;
                // Step 5: Apply HITL approval check - only show if user approved
                if (isApproved) {
                  onBudgetUpdate?.(parsed as BudgetData);
                }
              }
              // Weather data: destination + forecast array
              else if (
                parsed.destination &&
                parsed.forecast &&
                Array.isArray(parsed.forecast)
              ) {
                const weatherDataParsed = parsed as WeatherData;
                onWeatherUpdate?.(weatherDataParsed);
              }
              // Restaurant data: destination + meals array
              else if (
                parsed.destination &&
                parsed.meals &&
                Array.isArray(parsed.meals)
              ) {
                onRestaurantUpdate?.(parsed as RestaurantData);
              }
            }
          } catch (e) {
            // Silently handle parsing errors - not all messages contain structured data
          }
        }
      }
    };

    extractDataFromMessages();
  }, [
    visibleMessages,
    approvalStates,
    onItineraryUpdate,
    onBudgetUpdate,
    onWeatherUpdate,
    onRestaurantUpdate,
  ]);

  /**
   * A2A COMMUNICATION FEATURE: Register action for agent-to-agent messaging
   *
   * This useCopilotAction demonstrates CopilotKit's A2A (Agent-to-Agent) protocol,
   * which enables real-time communication between different AI agents while
   * providing visual feedback to users.
   *
   * Key features:
   * - Frontend-only action that doesn't block the chat interface
   * - Custom render function creates visual representation of agent communication
   * - Shows both outgoing messages (to agents) and incoming responses (from agents)
   * - Enables users to observe the multi-agent coordination process
   */
  useCopilotAction({
    name: "send_message_to_a2a_agent",
    description: "Sends a message to an A2A agent",
    available: "frontend", // This action runs on frontend only - no backend processing
    parameters: [
      {
        name: "agentName",
        type: "string",
        description: "The name of the A2A agent to send the message to",
      },
      {
        name: "task",
        type: "string",
        description: "The message to send to the A2A agent",
      },
    ],
    // Custom render function creates visual A2A communication components
    render: (actionRenderProps: MessageActionRenderProps) => {
      return (
        <>
          {/* MessageToA2A: Shows outgoing message (green box) */}
          <MessageToA2A {...actionRenderProps} />
          {/* MessageFromA2A: Shows agent response (blue box) */}
          <MessageFromA2A {...actionRenderProps} />
        </>
      );
    },
  });

  /**
   * HITL FEATURE: Budget approval workflow with renderAndWaitForResponse
   *
   * This useCopilotAction demonstrates CopilotKit's Human-in-the-Loop (HITL)
   * capabilities, which pause agent execution and wait for user interaction
   * before continuing the workflow.
   *
   * Key features:
   * - renderAndWaitForResponse: Blocks agent until user provides input
   * - State management: Tracks approval/rejection status across re-renders
   * - Business logic integration: Only proceeds with approved budgets
   * - Custom UI: Renders interactive approval card with approve/reject buttons
   * - Response handling: Sends user decision back to the agent
   */
  useCopilotAction(
    {
      name: "request_budget_approval",
      description: "Request user approval for the travel budget",
      parameters: [
        {
          name: "budgetData",
          type: "object",
          description: "The budget breakdown data requiring approval",
        },
      ],
      // renderAndWaitForResponse pauses agent execution until user responds
      renderAndWaitForResponse: ({ args, respond }) => {
        // Step 1: Validate budget data structure
        if (!args.budgetData || typeof args.budgetData !== "object") {
          return (
            <div className="text-xs text-gray-500 p-2">
              Loading budget data...
            </div>
          );
        }

        const budget = args.budgetData as BudgetData;

        if (!budget.totalBudget || !budget.breakdown) {
          return (
            <div className="text-xs text-gray-500 p-2">
              Loading budget data...
            </div>
          );
        }

        // Step 2: Create unique key for this budget to track approval state
        const budgetKey = `budget-${budget.totalBudget}`;
        const currentState = approvalStates[budgetKey] || {
          approved: false,
          rejected: false,
        };

        // Step 3: Define approval handler - updates state and responds to agent
        const handleApprove = () => {
          setApprovalStates((prev) => ({
            ...prev,
            [budgetKey]: { approved: true, rejected: false },
          }));
          // Send approval response back to agent to continue workflow
          respond?.({ approved: true, message: "Budget approved by user" });
        };

        // Step 4: Define rejection handler - updates state and responds to agent
        const handleReject = () => {
          setApprovalStates((prev) => ({
            ...prev,
            [budgetKey]: { approved: false, rejected: true },
          }));
          // Send rejection response back to agent to handle accordingly
          respond?.({ approved: false, message: "Budget rejected by user" });
        };

        // Step 5: Render interactive budget approval card
        return (
          <BudgetApprovalCard
            budgetData={budget}
            isApproved={currentState.approved}
            isRejected={currentState.rejected}
            onApprove={handleApprove}
            onReject={handleReject}
          />
        );
      },
    },
    [approvalStates] // Re-register when approval states change
  );

  /**
   * HITL FEATURE: Trip requirements form with data collection
   *
   * This useCopilotAction demonstrates another HITL pattern - collecting
   * structured user input before agent execution begins. This ensures
   * agents have all necessary information upfront.
   *
   * Key features:
   * - Pre-fills form fields with data extracted from user messages
   * - Validates user input (number ranges, required fields)
   * - Blocks agent execution until form is completed
   * - Passes collected data to backend agents for processing
   */
  useCopilotAction({
    name: "gather_trip_requirements",
    description:
      "Gather trip requirements from the user (city, days, people, budget level)",
    parameters: [
      {
        name: "city",
        type: "string",
        description:
          "The destination city (may be pre-filled from user message)",
        required: false, // Optional - can be extracted from user's natural language input
      },
      {
        name: "numberOfDays",
        type: "number",
        description: "Number of days for the trip (1-7)",
        required: false,
      },
      {
        name: "numberOfPeople",
        type: "number",
        description: "Number of people in the group (1-15)",
        required: false,
      },
      {
        name: "budgetLevel",
        type: "string",
        description: "Budget level: Economy, Comfort, or Premium",
        required: false,
      },
    ],
    // renderAndWaitForResponse blocks execution until form is submitted
    renderAndWaitForResponse: ({ args, respond }) => {
      // TripRequirementsForm handles form validation and submission
      return <TripRequirementsForm args={args} respond={respond} />;
    },
  });

  /**
   * GENERATIVE UI FEATURE: Inline weather display action
   *
   * This useCopilotAction demonstrates CopilotKit's ability to render
   * structured data as interactive UI components directly within the chat.
   * This creates a more engaging user experience than plain text responses.
   *
   * Key features:
   * - Frontend-only action for immediate UI rendering
   * - Data validation before rendering components
   * - Reusable components (WeatherCard used both inline and in main content)
   * - Seamless integration with chat flow
   */
  useCopilotAction({
    name: "display_weather_forecast",
    description: "Display weather forecast data as generative UI in the chat",
    available: "frontend", // No backend processing needed
    parameters: [
      {
        name: "weatherData",
        type: "object",
        description: "Weather forecast data to display",
      },
    ],
    render: ({ args }) => {
      // Step 1: Validate weather data structure
      if (!args.weatherData || typeof args.weatherData !== "object") {
        return <></>;
      }

      const weather = args.weatherData as WeatherData;

      // Step 2: Ensure required fields are present
      if (
        !weather.destination ||
        !weather.forecast ||
        !Array.isArray(weather.forecast)
      ) {
        return <></>;
      }

      // Step 3: Render interactive weather card component
      return (
        <div className="my-3">
          <WeatherCard data={weather} />
        </div>
      );
    },
  });

  /**
   * COPILOTKIT CHAT COMPONENT: Main chat interface
   *
   * The CopilotChat component provides the core chat interface with:
   * - Message history and real-time conversation
   * - Integration with all registered actions
   * - Customizable labels and instructions
   * - Built-in support for generative UI and HITL workflows
   */
  return (
    <div className="h-full">
      <CopilotChat
        className="h-full"
        labels={{
          initial:
            "👋 Hi! I'm your travel planning assistant.\n\nAsk me to plan a trip and I'll coordinate with specialized agents to create your perfect itinerary!",
        }}
        instructions="You are a helpful travel planning assistant. Help users plan their trips by coordinating with specialized agents."
      />
    </div>
  );
};

/**
 * MAIN COMPONENT: CopilotKit Provider Wrapper
 *
 * This is the main export that wraps the chat component with CopilotKit provider.
 * The provider configuration enables:
 * - Runtime connection to backend agents via /api/copilotkit endpoint
 * - A2A agent communication protocol
 * - Development console for debugging (disabled in production)
 *
 * Architecture flow:
 * 1. User interacts with CopilotChat interface
 * 2. Messages sent to backend via runtimeUrl
 * 3. Backend orchestrator coordinates with specialized agents
 * 4. Agent responses trigger registered actions (A2A, HITL, Generative UI)
 * 5. UI components render based on action results
 */
export default function TravelChat({
  onItineraryUpdate,
  onBudgetUpdate,
  onWeatherUpdate,
  onRestaurantUpdate,
}: TravelChatProps) {
  return (
    <CopilotKit
      runtimeUrl="/api/copilotkit" // Backend endpoint for agent communication
      showDevConsole={false} // Disable dev console in production
      agent="a2a_chat" // Specify A2A agent protocol
    >
      <ChatInner
        onItineraryUpdate={onItineraryUpdate}
        onBudgetUpdate={onBudgetUpdate}
        onWeatherUpdate={onWeatherUpdate}
        onRestaurantUpdate={onRestaurantUpdate}
      />
    </CopilotKit>
  );
}
