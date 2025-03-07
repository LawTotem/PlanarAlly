import { uuidv4 } from "../core/utils";

import type { IShape } from "./interfaces/shape";
import { dropFromSystems } from "./systems";

export type Global<T> = {
    [key in keyof T]: T[key] extends LocalId ? GlobalId : T[key] extends LocalId[] ? GlobalId[] : T[key];
};
export type GlobalId = string & { __brand: "globalId" };
export type LocalId = number & { __brand: "localId" };

// Array of GlobalId indexed by localId
let uuids: GlobalId[] = [];

const idMap: Map<LocalId, IShape> = new Map();
(window as any).idMap = idMap;

// we're not giving id 0 on purpose to prevent potential unsafe if checks against this
// Usually our explicit undefined check catches this, but because of our LocalId typing
// this can go wrong, preventing 0 from being obtainable solves a lot of future headaches.
let lastId = 0;
let freeIds: LocalId[] = [];
const reservedIds: Map<GlobalId, LocalId> = new Map();

export function clearIds(): void {
    uuids = [];
    idMap.clear();
    lastId = 0;
    freeIds = [];
    reservedIds.clear();
}

function generateId(): LocalId {
    return freeIds.pop() ?? (++lastId as LocalId);
}

// Prepare a LocalId for a GlobalId
// This is used when a shape is not fully created yet, but already requires some LocalId knowledge
export function reserveLocalId(uuid: GlobalId): LocalId {
    // double check if there is no local id already attached
    // can happen if multiple regions reserve for the same global id
    const localId = getLocalId(uuid, false);
    if (localId !== undefined) return localId;

    const local = generateId();
    uuids[local] = uuid;
    reservedIds.set(uuid, local);
    return local;
}

export function generateLocalId(shape: IShape, global?: GlobalId): LocalId {
    let local: LocalId;
    if (global && reservedIds.has(global)) {
        local = reservedIds.get(global)!;
        reservedIds.delete(global);
    } else {
        local = generateId();
        uuids[local] = global ?? uuidv4();
    }
    idMap.set(local, shape);
    return local;
}

export function dropId(id: LocalId): void {
    dropFromSystems(id);

    reservedIds.delete(uuids[id]);
    delete uuids[id];
    idMap.delete(id);
    freeIds.push(id);
}

export function getGlobalId(local: LocalId): GlobalId {
    return uuids[local];
}

(window as any).getGlobalId = getGlobalId;

export function getLocalId(global: GlobalId, _warn = true): LocalId | undefined {
    for (const [i, value] of uuids.entries()) {
        if (value === global) return i as LocalId;
    }
    if (_warn) console.warn("No local ID found for global id; This is likely a bug.");
}

(window as any).getLocalId = getLocalId;

export function getShape(local: LocalId): IShape | undefined {
    return idMap.get(local);
}

export function getShapeFromGlobal(global: GlobalId): IShape | undefined {
    const local = getLocalId(global);
    return local === undefined ? undefined : getShape(local);
}

export function getAllShapes(): IterableIterator<IShape> {
    return idMap.values();
}
