import type { DeepReadonly } from "vue";

import { registerSystem } from "..";
import type { System } from "..";
import { getGameState } from "../../../store/_game";
import {
    sendActiveLayer,
    sendFloorReorder,
    sendFloorSetBackground,
    sendFloorSetType,
    sendFloorSetVisible,
    sendRemoveFloor,
    sendRenameFloor,
} from "../../api/emits/floor";
import type { ILayer } from "../../interfaces/layer";
import type { IGridLayer } from "../../interfaces/layers/grid";
import { recalculateZIndices } from "../../layers/floor";
import { selectionState } from "../../layers/selection";
import { LayerName } from "../../models/floor";
import type { Floor, FloorId, FloorType } from "../../models/floor";
import { TriangulationTarget, visionState } from "../../vision/state";

import { floorState } from "./state";

type FloorRepresentation = { name: string } | { id: number } | { position: number };

const { $, _$, __$, currentFloor, currentLayer } = floorState;

class FloorSystem implements System {
    private indices: number[] = [];
    private lastFloorId = 0;
    private layerMap: Map<number, ILayer[]> = new Map();

    clear(): void {
        _$.floors = [];
        _$.floorIndex = -1 as FloorId;
        _$.layerIndex = -1;
        this.indices = [];
        this.lastFloorId = 0;
        this.layerMap.clear();
    }

    // FLOOR

    private _parseFloor(mode: "index", data: FloorRepresentation): FloorId | undefined;
    private _parseFloor(mode: "object", data: FloorRepresentation, readonly?: true): DeepReadonly<Floor> | undefined;
    private _parseFloor(mode: "object", data: FloorRepresentation, readonly: false): Floor | undefined;
    private _parseFloor(
        mode: "index" | "object",
        data: FloorRepresentation,
        readonly = true,
    ): number | DeepReadonly<Floor> | undefined {
        const method = mode === "index" ? "findIndex" : "find";
        const target = readonly === false ? _$ : $;
        if ("name" in data) return target.floors[method]((f) => f.name === data.name);
        if ("id" in data) return target.floors[method]((f) => f.id === data.id);
        return mode === "index" ? data.position : target.floors[data.position];
    }

    getFloor(data: FloorRepresentation, readonly: false): Floor | undefined;
    getFloor(data: FloorRepresentation, readonly?: true): DeepReadonly<Floor> | undefined;
    getFloor(data: FloorRepresentation, readonly = true): Floor | DeepReadonly<Floor> | undefined {
        return this._parseFloor("object", data, readonly as any); // any cast needed because overload signature is not visible
    }

    getFloorIndex(data: FloorRepresentation): FloorId | undefined {
        return this._parseFloor("index", data);
    }

    generateFloorId(): FloorId {
        return this.lastFloorId++ as FloorId;
    }

    addFloor(floor: Floor, targetIndex?: number): void {
        // We do some special magic here to allow out of order loading of floors on startup
        if (targetIndex !== undefined) {
            const I = this.indices.findIndex((i) => i > targetIndex);
            if (I >= 0) {
                this.indices.splice(I, 0, targetIndex);
                _$.floors.splice(I, 0, floor);
                if (I <= __$.floorIndex) _$.floorIndex = (__$.floorIndex + 1) as FloorId;
            } else {
                this.indices.push(targetIndex);
                _$.floors.push(floor);
            }
        } else {
            _$.floors.push(floor);
        }
        this.layerMap.set(floor.id, []);
    }

    selectFloor(targetFloor: FloorRepresentation, sync: boolean): void {
        const targetFloorIndex = this.getFloorIndex(targetFloor);
        if (targetFloorIndex === __$.floorIndex || targetFloorIndex === undefined) return;
        const floor = this.getFloor(targetFloor)!;

        _$.floorIndex = targetFloorIndex;
        _$.layers = this.getLayers(floor);
        for (const [fI, f] of __$.floors.entries()) {
            for (const layer of this.getLayers(f)) {
                if (fI > targetFloorIndex) layer.canvas.style.display = "none";
                else layer.canvas.style.removeProperty("display");
            }
        }
        this.selectLayer(currentLayer.value!.name, sync, false);
        this.invalidateAllFloors();
    }

    renameFloor(index: number, name: string, sync: boolean): void {
        _$.floors[index].name = name;
        if (index === __$.floorIndex) this.invalidateAllFloors();
        if (sync) sendRenameFloor({ index, name });
    }

    removeFloor(floorRepresentation: FloorRepresentation, sync: boolean): void {
        const floorIndex = this.getFloorIndex(floorRepresentation);
        if (floorIndex === undefined) throw new Error("Could not remove unknown floor");
        const floor = __$.floors[floorIndex];

        visionState.removeCdt(floor.id);
        visionState.removeBlockers(TriangulationTarget.MOVEMENT, floor.id);
        visionState.removeBlockers(TriangulationTarget.VISION, floor.id);

        for (const layer of this.getLayers(floor)) layer.canvas.remove();

        _$.floors.splice(floorIndex, 1);
        this.layerMap.delete(floor.id);

        if (__$.floorIndex === floorIndex) this.selectFloor({ position: floorIndex - 1 }, true);
        else if (__$.floorIndex > floorIndex) _$.floorIndex--;
        if (sync) sendRemoveFloor(floor.name);
    }

    setFloorPlayerVisible(floorRepresentation: FloorRepresentation, visible: boolean, sync: boolean): void {
        const floor = this.getFloor(floorRepresentation, false);
        if (floor === undefined) throw new Error("Could not update floor visibility for unknown floor");

        floor.playerVisible = visible;
        if (sync) sendFloorSetVisible({ name: floor.name, visible: floor.playerVisible });
    }

    reorderFloors(floors: string[], sync: boolean): void {
        const activeFloorName = __$.floors[__$.floorIndex].name;
        _$.floors = floors.map((name) => __$.floors.find((f) => f.name === name)!);
        _$.floorIndex = this.getFloorIndex({ name: activeFloorName })!;
        recalculateZIndices();
        if (sync) sendFloorReorder(floors);
    }

    setFloorType(floorRepr: FloorRepresentation, floorType: FloorType, sync: boolean): void {
        if (!getGameState().isDm) return;
        const floor = this.getFloor(floorRepr, false);
        if (floor === undefined) return;

        floor.type = floorType;
        if (sync) sendFloorSetType({ name: floor.name, floorType });
    }

    setFloorBackground(floorRepr: FloorRepresentation, backgroundValue: string | undefined, sync: boolean): void {
        if (!getGameState().isDm) return;
        const floor = this.getFloor(floorRepr, false);
        if (floor === undefined) return;

        floor.backgroundValue = backgroundValue;
        this.invalidate(floor);
        if (sync) sendFloorSetBackground({ name: floor.name, background: backgroundValue });
    }

    // LAYERS

    addLayer(layer: ILayer, floorId: number): void {
        for (const floor of __$.floors) {
            if (floor.id === floorId) {
                this.layerMap.get(floor.id)!.push(layer);
                if (__$.layerIndex < 0) {
                    _$.layerIndex = 2;
                }
                return;
            }
        }
        console.error(`Attempt to add layer to unknown floor ${floorId}`);
    }

    getLayer(floor: Floor, name?: LayerName): ILayer | undefined {
        const layers = this.layerMap.get(floor.id)!;
        if (name === undefined) return layers[__$.layerIndex];
        for (const layer of layers) {
            if (layer.name === name) return layer;
        }
    }

    getLayers(floor: Floor): ILayer[] {
        return this.layerMap.get(floor.id)!;
    }

    hasLayer(floor: Floor, name: LayerName): boolean {
        return this.layerMap.get(floor.id)?.some((f) => f.name === name) ?? false;
    }

    selectLayer(name: string, sync = true, invalidate = true): void {
        let found = false;
        selectionState.clear();
        for (const [index, layer] of this.getLayers(currentFloor.value!).entries()) {
            if (!layer.selectable) continue;
            if (found && layer.name !== LayerName.Lighting) layer.ctx.globalAlpha = 0.3;
            else layer.ctx.globalAlpha = 1.0;

            if (name === layer.name) {
                _$.layerIndex = index;
                found = true;
                if (sync) sendActiveLayer({ layer: layer.name, floor: this.getFloor({ id: layer.floor })!.name });
            }

            if (invalidate) layer.invalidate(true);
        }
    }

    getGridLayer(floor: Floor): IGridLayer | undefined {
        return this.getLayer(floor, LayerName.Grid) as IGridLayer;
    }

    // INVALIDATE

    invalidate(floorRepr: FloorRepresentation): void {
        const floor = this.getFloor(floorRepr, false)!;
        const layers = this.layerMap.get(floor.id)!;
        for (let i = layers.length - 1; i >= 0; i--) {
            layers[i].invalidate(true);
        }
    }

    invalidateAllFloors(): void {
        for (const floor of __$.floors) {
            this.invalidate(floor);
        }
    }

    invalidateVisibleFloors(): void {
        let floorFound = false;
        for (const floor of __$.floors) {
            if (floorFound) this.invalidateLight(floor.id);
            else this.invalidate(floor);
            if (floor === currentFloor.value) floorFound = true;
        }
    }

    // Lighting of multiple floors is heavily dependent on eachother
    // This method only updates a single floor and should thus only be used for very specific cases
    // as you typically require the allFloor variant
    invalidateLight(floorId: number): void {
        const layers = this.layerMap.get(floorId)!;
        for (let i = layers.length - 1; i >= 0; i--)
            if (layers[i].isVisionLayer || layers[i].name === "map") layers[i].invalidate(true);
    }

    invalidateLightAllFloors(): void {
        for (const [f, floor] of __$.floors.entries()) {
            if (f > __$.floorIndex) return;
            this.invalidateLight(floor.id);
        }
    }

    // WINDOW

    resize(width: number, height: number): void {
        for (const layer of [...this.layerMap.values()].flat()) {
            layer.resize(width, height);
        }
        this.invalidateAllFloors();
    }
}

export const floorSystem = new FloorSystem();
registerSystem("floors", floorSystem, false, floorState);
