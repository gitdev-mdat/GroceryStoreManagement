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


architect_llm = create_llm("haikieu-architect")
implementer_llm = create_llm("haikieu-implementer")
reviewer_llm = create_llm("haikieu-reviewer")
