import os

from crewai import LLM
from dotenv import load_dotenv


load_dotenv()

BASE_URL = os.environ["NINEROUTER_BASE_URL"]
API_KEY = os.environ["NINEROUTER_API_KEY"]


def create_llm(model: str) -> LLM:
    return LLM(
        model=model,
        custom_openai=True,
        base_url=BASE_URL,
        api_key=API_KEY,
        temperature=0,
    )


def test(model: str, expected: str) -> None:
    print(f"\nTesting {model}...")

    llm = create_llm(model)

    response = llm.call(
        messages=[
            {
                "role": "user",
                "content": f"Reply exactly with: {expected}",
            }
        ]
    )

    print(f"Response: {response}")

    if expected not in str(response):
        raise RuntimeError(f"{model} FAILED")

    print(f"{model}: PASS")


if __name__ == "__main__":
    test("haikieu-architect", "ARCHITECT_OK")
    test("haikieu-implementer", "IMPLEMENTER_OK")
    test("haikieu-reviewer", "REVIEWER_OK")

    print("\nALL 9ROUTER MODELS PASS")
