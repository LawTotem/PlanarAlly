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

from ...logs import logger

from typing_extensions import TypedDict
from ... import auth
from ...api.socket.constants import GAME_NS
from ...app import app, sio
from ...state.game import game_state
from datetime import datetime
from ...models import PlayerRoom
from ...models.gamelog import GameLog, GameLogEntry
from ...models.db import db

class LogInfo(TypedDict):
    source: str
    visibility: bool
    dtg: str
    contents: str


def FromGLE(gle: GameLogEntry) :
    le: LogInfo = LogInfo()
    le['source'] = gle.source
    le['visibility'] = gle.visibility
    le['dtg'] = gle.dtg
    le['contents'] = gle.contents
    return le

async def send_log_event(data: LogInfo) :
    for p_sid in game_state.get_sids():
        await sio.emit(
            "GameLog.Entry.Add", data=data, room=p_sid, namespace=GAME_NS
        )

def log_event(room : PlayerRoom, user_name : str, share : bool, contents : str) :
    log: GameLog = GameLog.get_or_none(room=room)
    if not log :
        with db.atomic() :
            log = GameLog.create(room=room)
    with db.atomic() :
        entry: GameLogEntry = GameLogEntry.create(
            log = log,
            contents = contents,
            source = user_name,
            visibility=share,
            dtg = datetime.utcnow().isoformat())
    return entry

async def log_event_sid(sid: str, share: bool, contents: str) :
    pr: PlayerRoom = game_state.get(sid)
    entry : GameLogEntry = log_event(pr.room, game_state.get_user(sid).name, share, contents)
    await send_log_event(FromGLE(entry))

@sio.on("GameLog.Contents.Short", namespace=GAME_NS)
@auth.login_required(app, sio, "game")
async def get_log_contents(sid: str, data: bool) :
    pr: PlayerRoom = game_state.get(sid)
    log: GameLog = GameLog.get_or_none(room=pr.room)
    logger.warning("Getting Game Log ")
    if log :
        ees = list(log.entries)
        end = len(ees)
        start = end - 20
        if start < 0 : start = 0
        for i in range(start,end) :
            await sio.emit(
                "GameLog.Entry.Add", data=FromGLE(ees[i]), room=sid, namespace=GAME_NS
            )
