import { toGP } from "../src/core/geometry";
import { addServerFloor } from "../src/game/floor/server";
import type { LocalId } from "../src/game/id";
import { generateLocalId } from "../src/game/id";
import type { IShape } from "../src/game/interfaces/shape";
import { LayerName } from "../src/game/models/floor";
import type { ServerFloor } from "../src/game/models/general";
import { Rect } from "../src/game/shapes/variants/rect";
import { floorSystem } from "../src/game/systems/floors";

export function generateTestShape(options?: { floor?: string }): IShape {
    const rect = new Rect(toGP(0, 0), 0, 0);
    if (options?.floor !== undefined) {
        let floor = floorSystem.getFloor({ name: options.floor });
        if (floor === undefined) {
            addServerFloor(generateTestFloor(options.floor));
            floor = floorSystem.getFloor({ name: options.floor })!;
        }
        rect.setLayer(floor.id, LayerName.Tokens);
    }
    rect.invalidate = () => {};
    return rect;
}

export function generateTestLocalId(shape?: IShape): LocalId {
    shape ??= generateTestShape();
    if (shape.id !== undefined) return shape.id;
    const id = generateLocalId(shape);
    (shape as any).id = id;
    return id;
}

function generateTestFloor(name?: string): ServerFloor {
    return {
        name: name ?? "test floor",
        player_visible: false,
        type_: 1,
        background_color: null,
        layers: [
            {
                groups: [],
                index: 0,
                name: "test",
                player_editable: false,
                player_visible: true,
                selectable: true,
                shapes: [],
                type_: "tokens",
            },
        ],
        index: 0,
    };
}
