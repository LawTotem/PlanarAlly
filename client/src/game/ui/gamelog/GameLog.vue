<!--
 MIT License

 Copyright (c) 2022 LawTotem#8511

 Permission is hereby granted, free of charge, to any person obtaining a copy
 of this software and associated documentation files (the "Software"), to deal
 in the Software without restriction, including without limitation the rights
 to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 copies of the Software, and to permit persons to whom the Software is
 furnished to do so, subject to the following conditions:

 The above copyright notice and this permission notice shall be included in all
 copies or substantial portions of the Software.

 THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 SOFTWARE.
-->

<script setup lang="ts">
import { toRef, onMounted } from "vue";
import { useI18n } from "vue-i18n";
import { useRouter } from "vue-router";

import Modal from "../../../core/components/modals/Modal.vue";

import { getGameState } from "../../../store/_game";
import { gamelogStore } from "./state";
import { LogData } from "../../models/gamelog"

const { t } = useI18n();

const gameState = getGameState();

const isDm = toRef(gameState, "isDm");

const close = (): void => gamelogStore.show(false);
const clearValues = (): void => gamelogStore.clear();

onMounted(() => gamelogStore.show(false));

function canSee(data: LogData): boolean {
    if ( data.visibility ) return true;
    if ( isDm.value ) return true;
    return false;
}

</script>

<template>
    <Modal :visible="gamelogStore.state.showGameLog" @close="close" :mask="false">
        <template v-slot:header="m">
            <div class="modal-header" draggable="true" @dragstart="m.dragStart" @dragend="m.dragEnd">
                <div>{{t("common.gamelog")}}</div>
                <div class="header-close" @click="close" :title="t('common.close')">
                    <font-awesome-icon :icon="['far', 'window-close']" />
                </div>
            </div>
        </template>
        <div class="modal-body">
            <ul>
                <li v-for="item in gamelogStore.state.data.filter(log => canSee(log))">
                    [{{ item.source }}] - {{ item.contents }}
                </li>
            </ul>
        </div>
    </Modal>
</template>

<style scoped lang="scss">
.modal-header {
    background-color: #ff7052;
    padding: 10px;
    font-size: 20px;
    font-weight: bold;
    cursor: move;
    min-width: 150px;
}

.header-close{
    position: absolute;
    top: 5px;
    right: 5px;
}

.modal-body {
    padding: 10px;
    max-width: 600px;
}
</style>