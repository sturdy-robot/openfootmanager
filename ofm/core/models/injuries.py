from enum import Enum, auto


class InjuryType(Enum):
    NONE = auto()
    LIGHT = auto()
    MILD = auto()
    SERIOUS = auto()
    VERY_SERIOUS = auto()
