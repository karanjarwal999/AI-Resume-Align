from typing import Annotated

from pydantic import BaseModel, Field, StringConstraints


SkillItem = Annotated[str, StringConstraints(min_length=1, max_length=60)]
ExperienceBullet = Annotated[str, StringConstraints(min_length=1, max_length=400)]
SuggestedAddition = Annotated[str, StringConstraints(min_length=1, max_length=60)]


class CustomizedResume(BaseModel):
    """LLM-produced tailored resume.

    The bounds are validated server-side after every Gemini call; a
    response that violates them is treated as a shape failure and
    triggers exactly one retry before the request is surfaced to the
    client as LLM_INVALID_RESPONSE.
    """

    summary: Annotated[str, StringConstraints(min_length=200, max_length=600)]
    skills: Annotated[list[SkillItem], Field(min_length=5, max_length=20)]
    experience: Annotated[list[ExperienceBullet], Field(min_length=3, max_length=30)]
    suggested_additions: Annotated[list[SuggestedAddition], Field(min_length=0, max_length=10)]
