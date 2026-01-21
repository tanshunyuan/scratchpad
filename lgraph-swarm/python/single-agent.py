from langchain_core.runnables import RunnableConfig
from langchain.agents.middleware import wrap_model_call, ModelRequest, ModelResponse
from langchain.messages import ToolMessage
from turtle import update
from langchain.tools import tool, ToolRuntime
from langchain.agents import AgentState, create_agent
from dotenv import load_dotenv
from langchain_openai import ChatOpenAI
from typing_extensions import NotRequired, Literal, Callable
from langgraph.types import Command
from langgraph.checkpoint.memory import InMemorySaver
from langchain.messages import HumanMessage
from langchain.agents.middleware import SummarizationMiddleware
import uuid
import os

load_dotenv()

OPENAI_API_KEY=os.getenv('OPENAI_API_KEY')

SupportStep = Literal['warranty_collector', 'issue_classifier', 'resolution_specialist']
WarrantyStatus = Literal['in_warranty', 'out_of_warranty']
IssueType = Literal['hardware', 'software']

# extends AgentState, it includes:
# * messages
# * jump_to
# * structured_response
class SupportState(AgentState):
    current_step: NotRequired[SupportStep]
    warranty_status: NotRequired[WarrantyStatus]
    issue_type: NotRequired[IssueType]

@tool
def record_warranty_status(
    status: WarrantyStatus,
    runtime: ToolRuntime[None, SupportState]
) -> Command:
    """Record the customer's warranty status and transition to issue classification."""
    return Command(
        update={
            "messages": [
                ToolMessage(
                    content=f"Warranty status recorded as: {status}",
                    tool_call_id=runtime.tool_call_id
                )
            ],
            "warranty_status": status,
            "current_step": "issue_classifier"
        }
    )

@tool
def record_issue_type(
    issue_type: IssueType,
    runtime: ToolRuntime[None, SupportState]
) -> Command:
    """Record the type of issue and transition to resolution specialist."""
    return Command(
        update={
            "messages": [
                ToolMessage(
                    content=f"Issue type recorded as: {issue_type}",
                    tool_call_id=runtime.tool_call_id
                )
            ],
            "issue_type": issue_type,
            "current_step": "resolution_specialist"
        }
    )

@tool
def escalate_to_human(reason: str) -> str:
    """Escalate the case to a human support specialist."""
    return f"Escalating to human support. Reason: {reason}"

@tool
def provide_solution(solution: str) -> str:
    """Provide a solution to the customer's issue."""
    return f"Solution provided: {solution}"

@tool
def go_back_to_warranty(reason: str, runtime: ToolRuntime[None, SupportState]) -> Command:
    """Go back to warranty verification step."""
    return Command(update={
        "messages": [
            ToolMessage(
                content=f"Going back to warranty verification step due to {reason}",
                tool_call_id=runtime.tool_call_id
            )
        ],
        "current_step": "warranty_collector"
    })

@tool
def go_back_to_classification(reason: str, runtime: ToolRuntime[None, SupportState]) -> Command:
    """Go back to issue classification step."""
    return Command(update={
        "messages": [
            ToolMessage(
                content=f"Going back to classification due to {reason}",
                tool_call_id=runtime.tool_call_id
            )
        ],
        "current_step": "issue_classifier"
    })

# Define prompts as constants for easy reference
WARRANTY_COLLECTOR_PROMPT = """You are a customer support agent helping with device issues.

CURRENT STAGE: Warranty verification

At this step, you need to:
1. Greet the customer warmly
2. Ask if their device is under warranty
3. Use record_warranty_status to record their response and move to the next step

Be conversational and friendly. Don't ask multiple questions at once."""

ISSUE_CLASSIFIER_PROMPT = """You are a customer support agent helping with device issues.

CURRENT STAGE: Issue classification
CUSTOMER INFO: Warranty status is {warranty_status}

At this step, you need to:
1. Ask the customer to describe their issue
2. Determine if it's a hardware issue (physical damage, broken parts) or software issue (app crashes, performance)
3. Use record_issue_type to record the classification and move to the next step

If unclear, ask clarifying questions before classifying."""

RESOLUTION_SPECIALIST_PROMPT = """You are a customer support agent helping with device issues.

CURRENT STAGE: Resolution
CUSTOMER INFO: Warranty status is {warranty_status}, issue type is {issue_type}

At this step, you need to:
1. For SOFTWARE issues: provide troubleshooting steps using provide_solution
2. For HARDWARE issues:
   - If IN WARRANTY: explain warranty repair process using provide_solution
   - If OUT OF WARRANTY: escalate_to_human for paid repair options

If the customer indicates any information was wrong, use:
- go_back_to_warranty to correct warranty status
- go_back_to_classification to correct issue type

Be specific and helpful in your solutions."""

# Step configuration: maps step name to (prompt, tools, required_state)
STEP_CONFIG = {
    "warranty_collector": {
        "prompt": WARRANTY_COLLECTOR_PROMPT,
        "tools": [record_warranty_status],
        "requires": [],
    },
    "issue_classifier": {
        "prompt": ISSUE_CLASSIFIER_PROMPT,
        "tools": [record_issue_type],
        "requires": ["warranty_status"],
    },
    "resolution_specialist": {
        "prompt": RESOLUTION_SPECIALIST_PROMPT,
        "tools": [provide_solution, escalate_to_human, go_back_to_warranty, go_back_to_classification],
        "requires": ["warranty_status", "issue_type"],
    },
}

@wrap_model_call
def apply_step_config(
    request: ModelRequest,
    handler: Callable[[ModelRequest], ModelResponse]
) -> ModelResponse:
    """Configure agent behavior based on the the current step."""
    current_step = request.state.get('current_step', 'warranty_collector')
    stage_config = STEP_CONFIG[current_step]

    for key in stage_config["requires"]:
        # ensures the value of the keys in the state are being set before proceeding
        if request.state.get(key) is None:
            raise ValueError(f"{key} must be set before reaching {current_step}")

    system_prompt = stage_config['prompt'].format(**request.state)

    request = request.override(
        system_prompt=system_prompt,
        tools=stage_config['tools']
    )
    return handler(request)

all_tools = [
    record_warranty_status,
    record_issue_type,
    provide_solution,
    escalate_to_human,
    go_back_to_classification,
    go_back_to_warranty
]

model = ChatOpenAI(model_name="gpt-4.1-mini")
agent = create_agent(
    model=model,
    tools=all_tools,
    state_schema=SupportState,
    middleware=[
        apply_step_config,
        # SummarizationMiddleware(
        #     model="gpt-4o-mini",
        #     trigger=("tokens", 4000),
        #     keep=("messages", 10)
        # )
    ],
    checkpointer=InMemorySaver()
)

# Configuration for this conversation thread
thread_id = str(uuid.uuid4())
config: RunnableConfig = {"configurable": {"thread_id": thread_id}}

# Turn 1: Initial message - starts with warranty_collector step
print("=== Turn 1: Warranty Collection ===")
result = agent.invoke(
    {"messages": [HumanMessage("Hi, my phone screen is cracked")]},
    config
)
for msg in result['messages']:
    msg.pretty_print()

# Turn 2: User responds about warranty
print("\n=== Turn 2: Warranty Response ===")
result = agent.invoke(
    {"messages": [HumanMessage("Yes, it's still under warranty")]},
    config
)
for msg in result['messages']:
    msg.pretty_print()
print(f"Current step: {result.get('current_step')}")

# Turn 3: User describes the issue
print("\n=== Turn 3: Issue Description ===")
result = agent.invoke(
    {"messages": [HumanMessage("The screen is physically cracked from dropping it")]},
    config
)
for msg in result['messages']:
    msg.pretty_print()
print(f"Current step: {result.get('current_step')}")

# Turn 4: Resolution
print("\n=== Turn 4: Resolution ===")
result = agent.invoke(
    {"messages": [HumanMessage("What should I do?")]},
    config
)

print("\n=== Turn 5: Oppsie ===")
result = agent.invoke(
    {"messages": [HumanMessage("Actually, I made a mistake - my device is out of warranty")]},
    config
)

for msg in result['messages']:
    msg.pretty_print()
