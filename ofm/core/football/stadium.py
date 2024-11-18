from uuid import UUID

from sqlmodel import Field, SQLModel


class Stadium(SQLModel):
    stadium_id: UUID = Field(default_factory=UUID, primary_key=True)
    name: str
    capacity: int
