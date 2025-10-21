import os
from dotenv import load_dotenv

from langgraph.prebuilt import create_react_agent
from langchain_openai import ChatOpenAI
from deepeval.integrations.langchain import CallbackHandler

load_dotenv()

CONFIDENT_API_KEY = os.getenv("CONFIDENT_API_KEY")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")


def get_weather(city: str) -> str:
    """Returns the weather in a city"""
    return f"It's always sunny in {city}!"


llm = ChatOpenAI(model="gpt-4o-mini")

agent = create_react_agent(
    model=llm,
    tools=[get_weather],
    prompt="You are a helpful assistant",
)

result = agent.invoke(
    input={"messages": [{"role": "user", "content": "what is the weather in russia"}]},
    config={"callbacks": [CallbackHandler(thread_id="123", user_id="567")]},
)

print(result)
