# MIT License

# Copyright (c) 2022 LawTotem#8511

# Permission is hereby granted, free of charge, to any person obtaining a copy
# of this software and associated documentation files (the "Software"), to deal
# in the Software without restriction, including without limitation the rights
# to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
# copies of the Software, and to permit persons to whom the Software is
# furnished to do so, subject to the following conditions:

# The above copyright notice and this permission notice shall be included in all
# copies or substantial portions of the Software.

# THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
# IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
# FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
# AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
# LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
# OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
# SOFTWARE.

import json
from typing import List

from peewee import ForeignKeyField, TextField, BooleanField
from playhouse.shortcuts import model_to_dict

from .base import BaseModel
from .user import User
from .campaign import Room


__all__ = ["GameLog", "GameLogEntry"]


class GameLog(BaseModel):
    id: int
    room = ForeignKeyField(Room, backref="game_log", on_delete="CASCADE")
    entries: List["GameLogEntry"]

    def __repr__(self) :
        return f"<GameLog {self.room.get_path()}>"

    def as_dict(self):
        gamelog = model_to_dict(self, recurse=False, exclude=[GameLog.id])
        gamelog["data"] = json.loads(gamelog["data"])
        return gamelog

class GameLogEntry(BaseModel):
    id: int
    log = ForeignKeyField(GameLog, backref="entries", on_delete="CASCADE")
    source = TextField(default="unknown", null="unknown")
    visibility = BooleanField(default=True, null=True)
    dtg = TextField(default="unknown", null="unknown")
    contents = TextField(default="unknown", null="unknown")