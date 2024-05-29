#      Openfoot Manager - A free and open source soccer management simulation
#      Copyright (C) 2020-2024  Pedrenrique G. Guimarães
#
#      This program is free software: you can redistribute it and/or modify
#      it under the terms of the GNU General Public License as published by
#      the Free Software Foundation, either version 3 of the License, or
#      (at your option) any later version.
#
#      This program is distributed in the hope that it will be useful,
#      but WITHOUT ANY WARRANTY; without even the implied warranty of
#      MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
#      GNU General Public License for more details.
#
#      You should have received a copy of the GNU General Public License
#      along with this program.  If not, see <https://www.gnu.org/licenses/>.
import uuid
from dataclasses import dataclass


@dataclass
class Stadium:
    stadium_id: uuid.UUID
    name: str
    capacity: int

    @classmethod
    def get_from_dict(cls, dictionary: dict[str, str | int]):
        return cls(
            uuid.UUID(int=dictionary["stadium_id"]),
            dictionary["name"],
            dictionary["capacity"],
        )

    def serialize(self):
        return {
            "stadium_id": self.stadium_id.int,
            "name": self.name,
            "capacity": self.capacity,
        }
