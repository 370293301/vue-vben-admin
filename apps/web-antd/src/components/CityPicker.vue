<template>
  <!-- mask -->
  <div v-if="visibleModel" class="cp-mask" @click.self="onMaskClick">
    <!-- modal box -->
    <div class="cp-modal" role="dialog" aria-modal="true">
      <div class="cp-header">
        <div class="cp-title">选择城市</div>
        <button class="cp-close" @click="handleCancel" aria-label="关闭">×</button>
      </div>

      <div class="cp-body">
        <div class="picker-wrap">
          <!-- 省 -->
          <div class="col col-province">
            <ul>
              <li
                v-for="prov in provinces"
                :key="prov.id"
                :class="{ active: prov.id === activeProvId }"
                @click="selectProvince(prov)"
              >
                {{ prov.name }}
              </li>
            </ul>
          </div>

          <!-- 市 -->
          <div class="col col-city">
            <ul>
              <li
                v-for="city in citiesOfActiveProv"
                :key="city.id"
                :class="{ active: city.id === activeCityId }"
                @click="selectCity(city)"
              >
                {{ city.name }}
              </li>
            </ul>
          </div>

          <!-- 区/县 -->
          <div class="col col-district">
            <ul>
              <li v-for="node in districtsOfActiveCity" :key="node.id">
                <label class="checkbox-label">
                  <input
                    type="checkbox"
                    :checked="!!checkedMap[node.id]"
                    @change="(e) => onCheckboxChange(node.id, e.target.checked)"
                  />
                  <span class="cb-text">{{ node.name }}</span>
                </label>
              </li>
            </ul>
          </div>

          <!-- 已选择 -->
          <div class="col col-selected">
            <div class="selected-header">
              <span>已选择（{{ selectedItems.length }}）</span>
              <a class="link-clear" @click="clearAll">清空</a>
            </div>

            <ul class="selected-list">
              <li v-for="it in selectedItems" :key="it.id">
                <span class="sel-name">{{ it.name }}</span>
                <a class="sel-remove" @click="removeOne(it)">删除</a>
              </li>
            </ul>

            <div class="actions">
              <button class="btn btn-default" @click="handleCancel">关闭</button>
              <button class="btn btn-primary" @click="handleConfirm">确定</button>
            </div>
          </div>
        </div>
      </div>
      <!-- footer 可以根据需要加 -->
    </div>
  </div>
</template>

<script lang="ts" setup>
import { computed, ref, reactive, watch } from 'vue';

const props = defineProps({
  visible: { type: Boolean, default: false },
  selected: { type: Array as () => number[], default: () => [] },
  cities: { type: Array as () => any[], default: () => [] },
});
const emit = defineEmits(['update:visible', 'update:selected', 'confirm', 'cancel']);

/* visible: 使用 computed getter/setter，setter 只在真实变化时 emit，避免循环 */
const visibleModel = computed({
  get() { return props.visible; },
  set(v: boolean) { if (v !== props.visible) emit('update:visible', v); }
});

/* 本地已选缓存（只在用户操作时 emit update:selected） */
const selectedIds = ref<number[]>(Array.isArray(props.selected) ? [...props.selected] : []);

/* 省市区状态 */
const activeProvId = ref<number | null>(null);
const activeCityId = ref<number | null>(null);

/* checkbox 状态映射（key: id -> boolean） */
const checkedMap = reactive<Record<number, boolean>>({});

/* 解析 cities */
const provinces = computed(() => props.cities || []);
const citiesOfActiveProv = computed(() => {
  const prov = provinces.value.find((p: any) => p.id === activeProvId.value);
  return prov && prov.children ? prov.children : [];
});
const districtsOfActiveCity = computed(() => {
  const city = citiesOfActiveProv.value.find((c: any) => c.id === activeCityId.value);
  return city && city.children ? city.children : [];
});

/* 右侧显示已选择项对象列表 */
const selectedItems = computed(() => {
  const items: any[] = [];
  if (!Array.isArray(props.cities)) return items;
  const idSet = new Set(selectedIds.value);
  for (const prov of props.cities) {
    if (!prov.children) continue;
    for (const city of prov.children) {
      if (!city.children) continue;
      for (const node of city.children) {
        if (idSet.has(node.id)) items.push(node);
      }
    }
  }
  return items;
});

/* 将外部 props.selected 同步到本地 selectedIds & checkedMap（只同步，不 emit） */
watch(
  () => props.selected,
  (v) => {
    const arr = Array.isArray(v) ? v.slice() : [];
    selectedIds.value = arr;
    // 初始化/同步 checkedMap
    for (const prov of provinces.value) {
      if (!prov.children) continue;
      for (const city of prov.children) {
        if (!city.children) continue;
        for (const node of city.children) {
          checkedMap[node.id] = arr.includes(node.id);
        }
      }
    }
  },
  { immediate: true }
);

/* 当 districts 切换，保证 checkedMap 中包含对应 key */
watch(districtsOfActiveCity, (list) => {
  for (const node of list) {
    if (typeof checkedMap[node.id] === 'undefined') {
      checkedMap[node.id] = selectedIds.value.includes(node.id);
    }
  }
});

/* 用户在 checkbox 上的操作 —— 明确用户动作时才 emit update:selected（避免循环） */
function onCheckboxChange(id: number, checked: boolean) {
  checkedMap[id] = checked;
  const s = new Set(selectedIds.value);
  if (checked) s.add(id); else s.delete(id);
  const next = Array.from(s).sort((a, b) => a - b);
  if (JSON.stringify(next) !== JSON.stringify(selectedIds.value)) {
    selectedIds.value = next;
    emit('update:selected', next);
  }
}

/* 省/市 切换逻辑（点击省/市） */
function selectProvince(prov: any) {
  activeProvId.value = prov.id;
  const firstCity = prov.children && prov.children[0];
  activeCityId.value = firstCity ? firstCity.id : null;
  // 同步当前 city 的 checked
  for (const node of districtsOfActiveCity.value) {
    checkedMap[node.id] = selectedIds.value.includes(node.id);
  }
}
function selectCity(city: any) {
  activeCityId.value = city.id;
  for (const node of districtsOfActiveCity.value) {
    checkedMap[node.id] = selectedIds.value.includes(node.id);
  }
}

/* 清空 / 删除 / 确认 / 取消 */
function clearAll() {
  selectedIds.value = [];
  for (const k in checkedMap) checkedMap[Number(k)] = false;
  emit('update:selected', []);
}
function removeOne(item: any) {
  const arr = selectedIds.value.filter((id) => id !== item.id);
  if (JSON.stringify(arr) !== JSON.stringify(selectedIds.value)) {
    selectedIds.value = arr;
    if (typeof checkedMap[item.id] !== 'undefined') checkedMap[item.id] = false;
    emit('update:selected', arr);
  }
}
function handleConfirm() {
  emit('confirm', selectedItems.value);
  visibleModel.value = false;
}
function handleCancel() {
  emit('cancel');
  visibleModel.value = false;
}

/* 遮罩点击（你要求 mask-closable=false 的话这里不关闭；若想允许遮罩关闭可改为 handleCancel） */
function onMaskClick() {
  // do nothing (mask-closable = false behavior)
  // 如果需要点击遮罩关闭，改成: handleCancel();
}
</script>

<style scoped>
/* mask 与 modal 基础样式（你可以根据主题微调颜色/圆角/阴影） */
.cp-mask {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1200;
}

.cp-modal {
  width: 900px;
  max-height: 80vh;
  background: var(--cp-bg, #0e0f11);
  color: var(--cp-color, #cfcfcf);
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 8px 40px rgba(0,0,0,0.6);
  display: flex;
  flex-direction: column;
}

/* header */
.cp-header {
  display:flex;
  align-items:center;
  justify-content:space-between;
  padding: 12px 16px;
  border-bottom: 1px solid rgba(255,255,255,0.03);
}
.cp-title { font-weight:600; }
.cp-close {
  background:transparent;
  border: none;
  color: #cfcfcf;
  font-size:18px;
  cursor: pointer;
}

/* body */
.cp-body { padding: 12px 16px; overflow: auto; flex:1; }
.picker-wrap {
  display: flex;
  gap: 12px;
  min-height: 300px;
}

/* columns */
.col { background: transparent; }
.col-province { width: 160px; }
.col-city { width: 160px; }
.col-district { width: 220px; }
.col-selected { flex: 1; min-width: 200px; }

/* lists */
.col ul { list-style:none; padding:0; margin:0; }
.col li { padding: 10px 12px; cursor: pointer; color: #bdbdbd; user-select:none; }
.col li.active { background: rgba(255,255,255,0.06); color: #66b1ff; border-radius:4px; }

/* checkbox label */
.checkbox-label { display:flex; align-items:center; gap:8px; cursor: pointer; user-select:none; color:#cfcfcf; }
.checkbox-label input { width: 16px; height:16px; }

/* selected area */
.selected-header { display:flex; justify-content:space-between; align-items:center; padding:8px 6px; color:#cfcfcf; }
.link-clear { color:#ff6b6b; cursor:pointer; text-decoration:none; }
.selected-list { padding:8px 6px; max-height: 260px; overflow:auto; }
.selected-list li { display:flex; justify-content:space-between; padding:6px 0; color:#d0d0d0; align-items:center; }
.sel-remove { color:#f56c6c; cursor:pointer; margin-left:12px; }

/* actions */
.actions { display:flex; gap:12px; justify-content:flex-end; padding:12px 6px; }
.btn { padding:8px 14px; border-radius:6px; border: none; cursor:pointer; font-weight:600; }
.btn-default { background: transparent; color: #cfcfcf; border: 1px solid rgba(255,255,255,0.04); }
.btn-primary { background: #1677ff; color: #fff; border: none; box-shadow: 0 2px 6px rgba(22,119,255,0.2); }

@media (max-width: 980px) {
  .cp-modal { width: 92%; }
  .col-province, .col-city { width:120px; }
  .col-district { width:160px; }
}
</style>
