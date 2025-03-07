<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";

import { SERVER_SYNC } from "../../core/models/types";
import { useModal } from "../../core/plugins/modals/plugin";
import { activeShapeStore } from "../../store/activeShape";
import { getShape } from "../id";
import { accessState } from "../systems/access/state";
import { auraSystem } from "../systems/auras";
import type { Aura, AuraId } from "../systems/auras/models";
import { propertiesSystem } from "../systems/properties";
import { getProperties, propertiesState } from "../systems/properties/state";
import { selectedSystem } from "../systems/selected";
import { trackerSystem } from "../systems/trackers";
import type { Tracker, TrackerId } from "../systems/trackers/models";

const { t } = useI18n();
const modals = useModal();

const shapeId = selectedSystem.getFocus();

const trackers = computed(() => [...trackerSystem.state.parentTrackers, ...trackerSystem.state.trackers.slice(0, -1)]);

const auras = computed(() => [...auraSystem.state.parentAuras, ...auraSystem.state.auras.slice(0, -1)]);

function setLocked(): void {
    if (accessState.hasEditAccess.value && shapeId !== undefined) {
        propertiesSystem.setLocked(shapeId.value!, !getProperties(shapeId.value!)!.isLocked, SERVER_SYNC);
    }
}

function openEditDialog(): void {
    activeShapeStore.setShowEditDialog(true);
}

async function changeValue(tracker: Tracker | Aura, isAura: boolean): Promise<void> {
    if (shapeId === undefined) return;

    const input = await modals.prompt(
        t("game.ui.selection.SelectionInfo.new_value_NAME", { name: tracker.name }),
        t("game.ui.selection.SelectionInfo.updating_NAME", { name: tracker.name }),
    );

    if (input === undefined || shapeId === undefined) return;

    let value = parseInt(input, 10);
    if (isNaN(value)) {
        return;
    }

    if (input[0] === "+" || input[0] === "-") {
        value += tracker.value;
    }

    if (isAura) {
        auraSystem.update(shapeId.value!, tracker.uuid as AuraId, { value }, SERVER_SYNC);
        const sh = getShape(shapeId.value!)!;
        sh.invalidate(false);
    } else {
        trackerSystem.update(shapeId.value!, tracker.uuid as TrackerId, { value }, SERVER_SYNC);
    }
}
</script>

<template>
    <div>
        <template v-if="shapeId !== undefined">
            <div id="selection-menu">
                <div id="selection-lock-button" @click="setLocked" :title="t('game.ui.selection.SelectionInfo.lock')">
                    <font-awesome-icon v-if="propertiesState.$.isLocked" icon="lock" />
                    <font-awesome-icon v-else icon="unlock" />
                </div>
                <div
                    id="selection-edit-button"
                    @click="openEditDialog"
                    :title="t('game.ui.selection.SelectionInfo.open_shape_props')"
                >
                    <font-awesome-icon icon="edit" />
                </div>
                <div id="selection-name">{{ propertiesState.$.name }}</div>
                <div id="selection-trackers">
                    <template v-for="tracker in trackers" :key="tracker.uuid">
                        <div>{{ tracker.name }}</div>
                        <div
                            class="selection-tracker-value"
                            @click="changeValue(tracker, false)"
                            :title="t('game.ui.selection.SelectionInfo.quick_edit_tracker')"
                        >
                            <template v-if="tracker.maxvalue === 0">
                                {{ tracker.value }}
                            </template>
                            <template v-else>{{ tracker.value }} / {{ tracker.maxvalue }}</template>
                        </div>
                    </template>
                </div>
                <div id="selection-auras">
                    <template v-for="aura in auras" :key="aura.uuid">
                        <div>{{ aura.name }}</div>
                        <div
                            class="selection-tracker-value"
                            @click="changeValue(aura, true)"
                            :title="t('game.ui.selection.SelectionInfo.quick_edit_aura')"
                        >
                            <template v-if="aura.dim === 0">
                                {{ aura.value }}
                            </template>
                            <template v-else>{{ aura.value }} / {{ aura.dim }}</template>
                        </div>
                    </template>
                </div>
            </div>
        </template>
    </div>
</template>

<style scoped lang="scss">
#selection-menu {
    position: absolute;
    pointer-events: auto;
    display: flex;
    flex-direction: column;
    top: 75px;
    right: 0;
    z-index: 10;
    opacity: 0.5;
    border-top-left-radius: 5px;
    border-bottom-left-radius: 5px;
    border: #82c8a0 solid 1px;
    border-right: none;
    padding: 10px 35px 10px 10px;
    background-color: #eee;

    &:hover {
        background-color: #82c8a0;
        opacity: 1;
    }
}

#selection-lock-button {
    position: absolute;
    right: 13px;
    top: 30px;
    cursor: pointer;
}

#selection-edit-button {
    position: absolute;
    right: 10px;
    top: 10px;
    cursor: pointer;
}

#selection-trackers,
#selection-auras {
    display: grid;
    grid-template-columns: [name] 1fr [value] 1fr;
}

.selection-tracker-value,
.selection-aura-value {
    justify-self: center;
    padding: 2px;

    &:hover {
        cursor: pointer;
        background-color: rgba(20, 20, 20, 0.2);
    }
}

#selection-name {
    font-size: 20px;
    font-weight: bold;
    margin-bottom: 10px;
}
</style>
