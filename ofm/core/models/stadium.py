from sqlalchemy import ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column

from .basemodel import BaseModel


class Stadium(BaseModel):
    __tablename__ = "stadium"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column()
    capacity: Mapped[int]

    def __repr__(self) -> str:
        return f"Stadium(id={self.id}, name={self.name}, capacity={self.capacity})"
