import { gameStore } from "../store/game";
import { locationStore } from "../store/location";

import { clearIds } from "./id";
import { compositeState } from "./layers/state";
import { stopDrawLoop } from "./rendering/core";
import { clearSystems } from "./systems";
import { initiativeStore } from "./ui/initiative/state";
import { visionState } from "./vision/state";
import { gamelogStore } from "./ui/gamelog/state";

export function clearGame(): void {
    stopDrawLoop();
    gameStore.clear();
    visionState.clear();
    locationStore.setLocations([], false);
    document.getElementById("layers")!.innerHTML = "";
    compositeState.clear();
    initiativeStore.clear();
    gamelogStore.clear();
    clearSystems();
    clearIds();
}
