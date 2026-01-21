from langchain_core.runnables import RunnableConfig
from langchain.agents.middleware import wrap_model_call, ModelRequest, ModelResponse
from langchain.messages import ToolMessage
from langchain.tools import tool, ToolRuntime
from langchain.agents import AgentState, create_agent
from dotenv import load_dotenv
from langchain_openai import ChatOpenAI
from typing_extensions import NotRequired, Literal, Callable
from langgraph.types import Command
from langgraph.checkpoint.memory import InMemorySaver
from langchain.messages import HumanMessage
import gradio as gr
import uuid
import os

load_dotenv()

OPENAI_API_KEY = os.getenv('OPENAI_API_KEY')

SupportStep = Literal['warranty_collector', 'issue_classifier', 'resolution_specialist']
WarrantyStatus = Literal['in_warranty', 'out_of_warranty']
IssueType = Literal['hardware', 'software']


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
def go_back_to_classification() -> Command:
    """Go back to issue classification step."""
    return Command(update={"current_step": "issue_classifier"})


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
    """Configure agent behavior based on the current step."""
    current_step = request.state.get('current_step', 'warranty_collector')
    stage_config = STEP_CONFIG[current_step]

    for key in stage_config["requires"]:
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

model = ChatOpenAI(model_name="gpt-4o-mini")
agent = create_agent(
    model=model,
    tools=all_tools,
    state_schema=SupportState,
    middleware=[apply_step_config],
    checkpointer=InMemorySaver()
)

# Store thread_id per session
session_threads = {}


def chat_function(message, history, request: gr.Request):
    """
    Gradio chat function that maintains conversation state.

    Args:
        message: Current user message
        history: Chat history (list of [user_msg, bot_msg] pairs)
        request: Gradio request object (contains session info)

    Returns:
        Updated history with new message pair
    """
    # Get or create thread_id for this session
    session_id = request.session_hash
    if session_id not in session_threads:
        session_threads[session_id] = str(uuid.uuid4())

    thread_id = session_threads[session_id]
    config: RunnableConfig = {"configurable": {"thread_id": thread_id}}

    # Invoke agent with user message
    result = agent.invoke(
        {"messages": [HumanMessage(message)]},
        config
    )

    # Extract the last AI message
    ai_message = ""
    for msg in reversed(result['messages']):
        if hasattr(msg, 'content') and msg.content and not isinstance(msg, HumanMessage):
            ai_message = msg.content
            break

    # Add debug info (optional)
    current_step = result.get('current_step', 'unknown')
    warranty = result.get('warranty_status', 'not set')
    issue = result.get('issue_type', 'not set')

    debug_info = f"\n\n_[Step: {current_step} | Warranty: {warranty} | Issue: {issue}]_"

    # Return updated history
    history.append((message, ai_message + debug_info))
    return history


# Create Gradio interface
with gr.Blocks(title="AI Support Agent") as demo:
    gr.Markdown("# Customer Support Agent")
    gr.Markdown("Chat with an AI agent that guides you through warranty verification, issue classification, and resolution.")

    chatbot = gr.Chatbot(height=500)

    with gr.Row():
        msg_input = gr.Textbox(
            placeholder="Type your message here...",
            container=False,
            scale=7
        )
        submit_btn = gr.Button("Send", scale=1, variant="primary")

    clear_btn = gr.Button("Clear Chat")

    def clear_chat(request: gr.Request):
        """Clear chat and reset session."""
        session_id = request.session_hash
        if session_id in session_threads:
            del session_threads[session_id]
        return []

    # Wire up the chat
    msg_input.submit(
        chat_function,
        inputs=[msg_input, chatbot],
        outputs=[chatbot]
    ).then(
        lambda: "",
        outputs=[msg_input]
    )

    submit_btn.click(
        chat_function,
        inputs=[msg_input, chatbot],
        outputs=[chatbot]
    ).then(
        lambda: "",
        outputs=[msg_input]
    )

    clear_btn.click(clear_chat, inputs=[], outputs=[chatbot])

if __name__ == "__main__":
    demo.launch()
