/**
 * MIT License

 * Copyright (c) 2022 LawTotem#8511

 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:

 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.

 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

import { Store } from "../../../core/store";

import { requestLogs } from "../../api/emits/gamelog";

import { LogData } from "../../models/gamelog";

interface GameLogState {
    showGameLog: boolean;
    data: LogData[];
}

class GameLogStore extends Store<GameLogState> {
    constructor() {
        super();
        requestLogs(true);
    }

    protected data(): GameLogState {
        return {
            showGameLog: false,
            data: [ ]
        };
    }

    clear(): void {
        this._state.data = [];
    }

    show(show: boolean): void {
        this._state.showGameLog = show;
    }

    addLine(line: LogData): void {
        this._state.data.push(line);
        while (this._state.data.length > 10)
        {
            this._state.data.shift();
        }
    }
}

export const gamelogStore = new GameLogStore();
(window as any).gamelogStore = gamelogStore;