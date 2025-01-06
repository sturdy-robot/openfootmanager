import datetime

from sqlalchemy import ForeignKey
from sqlalchemy.orm import Mapped, mapped_column

from .basemodel import BaseModel
from .club import Club
from .player import Player


class PlayerContract(BaseModel):
    __tablename__ = "playercontract"

    id: Mapped[int] = mapped_column(primary_key=True)
    player_id: Mapped["Player"] = mapped_column(ForeignKey("player.id"))
    team_id: Mapped["Club"] = mapped_column(ForeignKey("club.id"))
    start_date: Mapped[datetime.date]
    end_date: Mapped[datetime.date]
    wages: Mapped[int]

    def __repr__(self) -> str:
        return f"PlayerContract(player_id={self.player_id}, team_id={self.team_id}, start_date={self.start_date}, end_date={self.end_date}, wages={self.wages})"
