import datetime
from enum import Enum, auto
from typing import Optional

from sqlalchemy import Date
from sqlalchemy import Enum as SEnum
from sqlalchemy import ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..football.player_attributes import PlayerAttributes
from .basemodel import BaseModel
from .club import Club
from .contract import PlayerContract
from .injuries import InjuryType
from .positions import Positions, PositionsList


class PreferredFoot(Enum):
    LEFT = auto()
    RIGHT = auto()


class Player(BaseModel):
    __tablename__ = "player"

    id: Mapped[int] = mapped_column(primary_key=True)
    club_id: Mapped[int | None] = mapped_column(ForeignKey("club.id"), nullable=True)
    club: Mapped["Club | None"] = relationship(back_populates="squad")
    shirt_number: Mapped[Optional[int]] = mapped_column(nullable=True)
    contract: Mapped[Optional["PlayerContract"]] = mapped_column(
        ForeignKey("playercontract.id"), nullable=True
    )
    first_name: Mapped[str] = mapped_column(String(255))
    last_name: Mapped[str] = mapped_column(String(255))
    short_name: Mapped[str] = mapped_column(String(50))
    nationality: Mapped[str]
    birthday: Mapped[datetime.date] = mapped_column(Date)
    age: Mapped[int]
    fitness: int
    form: int
    stamina: int
    positions: Mapped[list[Positions]] = mapped_column(PositionsList)
    is_injured: Mapped[bool] = mapped_column(default=False)
    injury_type: Mapped[InjuryType] = mapped_column(
        SEnum(InjuryType), default=InjuryType.NONE
    )
    attributes: Mapped[PlayerAttributes]
    international_reputation: Mapped[int]
    value: int
    preferred_foot: Mapped[PreferredFoot] = mapped_column(SEnum(PreferredFoot))
    potential_skill: int

    def __repr__(self) -> str:
        return f"Player(id={self.id}, name={self.short_name}, age={self.age})"


class PlayerStats(BaseModel):
    __tablename__ = "playerstats"

    id: Mapped[int] = mapped_column(primary_key=True)
    player_id: Mapped["Player"] = mapped_column(ForeignKey("player.id"))
    minutes_played: Mapped[int]
    passes: Mapped[int]
    passes_missed: Mapped[int]
    crosses: Mapped[int]
    crosses_missed: Mapped[int]
    dribbles: Mapped[int]
    dribbles_failed: Mapped[int]
    shots: Mapped[int]
    shots_on_target: Mapped[int]
    shots_missed: Mapped[int]
    shots_blocked: Mapped[int]
    interceptions: Mapped[int]
    assists: Mapped[int]
    fouls: Mapped[int]
    goals: Mapped[int]
    goals_conceded: Mapped[int]
    shots_saved: Mapped[int]
    own_goals: Mapped[int]
    penalties: Mapped[int]
    injuries: Mapped[int]
    yellow_cards: Mapped[int]
    red_cards: Mapped[int]
    rating: Mapped[float]
