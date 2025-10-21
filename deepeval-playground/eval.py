import os
from dotenv import load_dotenv

from langgraph.prebuilt import create_react_agent
from langchain_openai import ChatOpenAI
from deepeval.integrations.langchain import CallbackHandler
from deepeval.dataset import EvaluationDataset, Golden
from deepeval.metrics import AnswerRelevancyMetric
from deepeval.dataset import EvaluationDataset
from deepeval.test_case import LLMTestCase

from deepeval import evaluate

load_dotenv()

CONFIDENT_API_KEY = os.getenv("CONFIDENT_API_KEY")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")


def create_dataset() -> None:
    print("at create_dataset")
    # goldens are what makes up your dataset
    goldens = [Golden(input="What's the weather like in SF?")]
    # create dataset
    dataset = EvaluationDataset(goldens=goldens)
    # save to Confident AI
    dataset.push(alias="DEEPEVAL-PLAYGROUND")
    print("create_dataset END")


def get_weather(city: str) -> str:
    """Returns the weather in a city"""
    return f"It's always sunny in {city}!"


def evaluate_dataset() -> None:
    dataset = EvaluationDataset()
    dataset.pull(alias="DEEPEVAL-PLAYGROUND")

    llm = ChatOpenAI(model="gpt-4o-mini")

    agent = create_react_agent(
        model=llm,
        tools=[get_weather],
        prompt="You are a helpful assistant",
    )

    for golden in dataset.goldens:
        result = agent.invoke(
            input={"messages": [{"role": "user", "content": golden.input}]},
            config={"callbacks": [CallbackHandler(thread_id="89", user_id="1011")]},
        )
        final_message = result["messages"][-1]
        string_output = final_message.content
        test_case = LLMTestCase(
            input=golden.input,
            actual_output=string_output,
        )
        dataset.add_test_case(test_case)
    evaluate(test_cases=dataset.test_cases, metrics=[AnswerRelevancyMetric()])


# create_dataset()
evaluate_dataset()
