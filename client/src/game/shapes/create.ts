import { toGP } from "../../core/geometry";
import { baseAdjust } from "../../core/http";
import { hasGroup, addGroupMembers } from "../groups";
import { reserveLocalId, getLocalId } from "../id";
import type { IShape } from "../interfaces/shape";
import type {
    ServerShape,
    ServerRect,
    ServerCircle,
    ServerCircularToken,
    ServerLine,
    ServerPolygon,
    ServerText,
    ServerAsset,
    ServerToggleComposite,
} from "../models/shapes";

import { Asset } from "./variants/asset";
import { Circle } from "./variants/circle";
import { CircularToken } from "./variants/circularToken";
import { Line } from "./variants/line";
import { Polygon } from "./variants/polygon";
import { Rect } from "./variants/rect";
import { Text } from "./variants/text";
import { ToggleComposite } from "./variants/toggleComposite";

export function createShapeFromDict(shape: ServerShape): IShape | undefined {
    let sh: IShape;

    // A fromJSON and toJSON on Shape would be cleaner but ts does not allow for static abstracts so yeah.

    if (shape.group !== undefined && shape.group !== null) {
        const group = hasGroup(shape.group);
        if (group === undefined) {
            console.log("Missing group info detected");
        } else {
            addGroupMembers(shape.group, [{ uuid: reserveLocalId(shape.uuid), badge: shape.badge }], false);
        }
    }

    // Shape Type specifics

    const refPoint = toGP(shape.x, shape.y);
    if (shape.type_ === "rect") {
        const rect = shape as ServerRect;
        sh = new Rect(refPoint, rect.width, rect.height, {
            uuid: rect.uuid,
        });
    } else if (shape.type_ === "circle") {
        const circ = shape as ServerCircle;
        sh = new Circle(refPoint, circ.radius, {
            uuid: circ.uuid,
        });
    } else if (shape.type_ === "circulartoken") {
        const token = shape as ServerCircularToken;
        sh = new CircularToken(refPoint, token.radius, token.text, token.font, {
            uuid: token.uuid,
        });
    } else if (shape.type_ === "line") {
        const line = shape as ServerLine;
        sh = new Line(refPoint, toGP(line.x2, line.y2), {
            lineWidth: line.line_width,
            uuid: line.uuid,
        });
    } else if (shape.type_ === "polygon") {
        const polygon = shape as ServerPolygon;
        sh = new Polygon(
            refPoint,
            polygon.vertices.map((v) => toGP(v)),
            {
                lineWidth: [polygon.line_width],
                openPolygon: polygon.open_polygon,
                uuid: polygon.uuid,
            },
        );
    } else if (shape.type_ === "text") {
        const text = shape as ServerText;
        sh = new Text(refPoint, text.text, text.font_size, {
            uuid: text.uuid,
        });
    } else if (shape.type_ === "assetrect") {
        const asset = shape as ServerAsset;
        const img = new Image(asset.width, asset.height);
        if (asset.src.startsWith("http")) img.src = baseAdjust(new URL(asset.src).pathname);
        else img.src = baseAdjust(asset.src);
        sh = new Asset(img, refPoint, asset.width, asset.height, { uuid: asset.uuid, loaded: false });
        img.onload = () => {
            (sh as Asset).setLoaded();
        };
    } else if (shape.type_ === "togglecomposite") {
        const toggleComposite = shape as ServerToggleComposite;

        sh = new ToggleComposite(
            refPoint,
            getLocalId(toggleComposite.active_variant)!,
            toggleComposite.variants.map((v) => ({ uuid: getLocalId(v.uuid)!, name: v.name })),
            {
                uuid: toggleComposite.uuid,
            },
        );
    } else {
        return undefined;
    }
    sh.fromDict(shape);
    return sh;
}
