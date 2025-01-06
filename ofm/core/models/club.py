from sqlalchemy import ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .basemodel import BaseModel
from .player import Player
from .stadium import Stadium


class Club(BaseModel):
    __tablename__ = "club"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str]
    country: Mapped[str]
    location: Mapped[str]
    default_formation: Mapped[str]
    squad: Mapped[list["Player"]] = relationship(
        back_populates="club", cascade="all, delete-orphan"
    )
    default_formation: Mapped[str]
    stadium_id: Mapped["Stadium"] = mapped_column(ForeignKey("stadium.id"))

    def __repr__(self) -> str:
        return f"Club(id={self.id}, name={self.name})"
