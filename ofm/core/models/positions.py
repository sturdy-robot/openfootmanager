import json
from enum import Enum, auto

from sqlalchemy import Integer, TypeDecorator


class Positions(Enum):
    GK = auto()
    DF = auto()
    MF = auto()
    FW = auto()


class PositionsList(TypeDecorator):
    impl = Integer

    def process_bind_param(self, value, dialect):
        if value is None:
            return None
        return json.dumps([e.value for e in value])

    def process_result_value(self, value, dialect):
        if value is None:
            return None
        return [Positions[e] for e in json.loads(value)]
