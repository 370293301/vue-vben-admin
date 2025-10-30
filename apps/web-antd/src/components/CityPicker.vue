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
                v-for="prov in filteredProvinces"
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
import { theme } from 'ant-design-vue';

// ✅ 获取 Ant Design Token
const { token } = theme.useToken();

interface CityNode {
  id: number;
  name: string;
  level?: number;
  children?: CityNode[];
  pid?: number;
}

const props = defineProps({
  visible: { type: Boolean, default: false },
  selected: { type: Array as () => number[], default: () => [] },
  cities: { type: Array as () => CityNode[], default: () => [] },
  cityIdList: { type: [String, Array] as any, default: () => [] }, // ✨ 新增：只显示这些城市ID
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

/* ✨ 解析 cityIdList（可能是字符串或数组） */
const allowedCityIdSet = computed(() => {
  const set = new Set<number>();

  // ✅ 优先使用 localStorage 中的 cityIdList
  const cityIdListFromStorage = localStorage.getItem('cityIdList');
  const cityIdListToUse = cityIdListFromStorage || props.cityIdList;

  if (!cityIdListToUse) return set;

  let ids: number[] = [];

  if (typeof cityIdListToUse === 'string') {
    // "1220101,1220102,1220103" 或 "1220101;资阳市;资阳,1220102;..." 格式
    const items = cityIdListToUse.split(',');
    for (const item of items) {
      const parts = item.split(';');
      const id = Number(parts[0]?.trim());
      if (Number.isFinite(id) && id > 0) {
        ids.push(id);
      }
    }
  } else if (Array.isArray(cityIdListToUse)) {
    // 直接是数组格式
    for (const item of cityIdListToUse) {
      if (typeof item === 'number') {
        ids.push(item);
      } else if (typeof item === 'string') {
        const id = Number(item);
        if (Number.isFinite(id) && id > 0) {
          ids.push(id);
        }
      }
    }
  }

  ids.forEach(id => set.add(id));
  return set;
});

const cityMap = computed(() => {
  const map = new Map<number, CityNode>();

  function buildMap(nodes: CityNode[] | undefined) {
    if (!nodes) return;
    for (const node of nodes) {
      map.set(node.id, node);
      if (node.children) {
        buildMap(node.children);
      }
    }
  }

  buildMap(props.cities);
  return map;
});

/* ✨ 获取节点的所有父节点ID */
function getAllParentIds(nodeId: number): Set<number> {
  const parentIds = new Set<number>();
  let current = cityMap.value.get(nodeId);

  while (current && current.pid) {
    parentIds.add(current.pid);
    current = cityMap.value.get(current.pid);
  }

  return parentIds;
}


/* ✨ 改进：不再将父级ID加入 visibleIdSet，而是单独判断 */
const visibleIdSet = computed(() => {
  const visible = new Set<number>();

  // 如果没有指定 cityIdList，显示全部
  if (allowedCityIdSet.value.size === 0) {
    for (const node of cityMap.value.values()) {
      visible.add(node.id);
    }
    return visible;
  }

  // ✅ 只添加允许的城市ID，不添加父级
  for (const id of allowedCityIdSet.value) {
    visible.add(id);
  }

  return visible;
});
/* ✨ 检查一个节点或其子孙节点中是否有被允许的城市 */
function hasAllowedDescendants(node: CityNode): boolean {
  // 如果没有限制，全部允许
  if (allowedCityIdSet.value.size === 0) {
    return true;
  }

  // 检查自己是否在允许列表中
  if (visibleIdSet.value.has(node.id)) {
    return true;
  }

  // 递归检查子节点
  if (node.children && node.children.length > 0) {
    return node.children.some(child => hasAllowedDescendants(child));
  }

  return false;
}
/* ✨ 递归过滤树 - 只显示可见的节点 */
function filterTreeByVisibleIds(nodes: CityNode[] | undefined): CityNode[] {
  if (!nodes) return [];

  return nodes
    .filter((node) => {
      // 检查该节点或其子孙中是否有允许的城市
      return hasAllowedDescendants(node);
    })
    .map((node) => {
      // 递归过滤子节点
      const filteredChildren = node.children
        ? filterTreeByVisibleIds(node.children)
        : [];

      return {
        ...node,
        children: filteredChildren,
      };
    });
}

/* ✨ 过滤后的省份列表 */
const filteredProvinces = computed(() => {
  return filterTreeByVisibleIds(props.cities);
});

/* 解析 cities */
const citiesOfActiveProv = computed(() => {
  const prov = filteredProvinces.value.find((p: any) => p.id === activeProvId.value);
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
/* ✅ 当过滤后的省份列表变化时，自动选择第一个省份 */
watch(
  filteredProvinces,
  (provinces) => {
    if (provinces.length > 0) {
      // 如果当前选中的省份不在过滤列表中，或者没有选中省份
      const isCurrentProvVisible = provinces.some(p => p.id === activeProvId.value);

      if (!isCurrentProvVisible) {
        // 自动选择第一个省份
        selectProvince(provinces[0]);
      }
    } else {
      // 没有可见省份，清空选择
      activeProvId.value = null;
      activeCityId.value = null;
    }
  },
  { immediate: true }
);

/* ✅ 当 visible 变为 true 时，也重新初始化选择 */
watch(
  () => props.visible,
  (visible) => {
    if (visible && filteredProvinces.value.length > 0) {
      const isCurrentProvVisible = filteredProvinces.value.some(
        p => p.id === activeProvId.value
      );

      if (!isCurrentProvVisible) {
        selectProvince(filteredProvinces.value[0]);
      }
    }
  }
);
/* 将外部 props.selected 同步到本地 selectedIds & checkedMap（只同步，不 emit） */
watch(
  () => props.selected,
  (v) => {
    const arr = Array.isArray(v) ? v.slice() : [];
    selectedIds.value = arr;
    // 初始化/同步 checkedMap（只处理允许的城市）
    for (const id of allowedCityIdSet.value) {
      const node = cityMap.value.get(id);
      if (node) {
        checkedMap[id] = arr.includes(id);
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
  const ids = selectedIds.value || [];

  let payload: string | number | null = null;
  if (ids.length > 1) {
    payload = ids.join(',');
  } else if (ids.length === 1) {
    payload = ids[0];
  }

  emit('confirm', payload);
  visibleModel.value = false;
}
function handleCancel() {
  emit('cancel');
  visibleModel.value = false;
}

/* 遮罩点击 */
function onMaskClick() {
  // do nothing (mask-closable = false behavior)
}
</script>

<style scoped>
/* ✅ 使用 v-bind 绑定 token 颜色 */

/* mask 与 modal 基础样式 */
.cp-mask {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1200;
}

.cp-modal {
  width: 900px;
  max-height: 80vh;
  background: v-bind('token.colorBgElevated');
  color: v-bind('token.colorText');
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 8px 40px rgba(0, 0, 0, 0.6);
  display: flex;
  flex-direction: column;
}

/* header */
.cp-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid v-bind('token.colorBorderSecondary');
}
.cp-title {
  font-weight: 600;
  color: v-bind('token.colorText');
}
.cp-close {
  background: transparent;
  border: none;
  color: v-bind('token.colorTextSecondary');
  font-size: 18px;
  cursor: pointer;
  transition: color 0.3s;
}
.cp-close:hover {
  color: v-bind('token.colorText');
}

/* body */
.cp-body {
  padding: 12px 16px;
  overflow: auto;
  flex: 1;
}
.picker-wrap {
  display: flex;
  gap: 12px;
  min-height: 300px;
}

/* columns */
.col {
  background: transparent;
}
.col-province {
  width: 160px;
}
.col-city {
  width: 160px;
}
.col-district {
  width: 220px;
}
.col-selected {
  flex: 1;
  min-width: 200px;
}

/* lists */
.col ul {
  list-style: none;
  padding: 0;
  margin: 0;
}
.col li {
  padding: 10px 12px;
  cursor: pointer;
  color: v-bind('token.colorTextSecondary');
  user-select: none;
  border-radius: 4px;
  transition: all 0.3s;
}
.col li:hover {
  background: v-bind('token.colorBgTextHover');
  color: v-bind('token.colorText');
}
.col li.active {
  background: v-bind('token.colorPrimaryBg');
  color: v-bind('token.colorPrimary');
}

/* checkbox label */
.checkbox-label {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  user-select: none;
  color: v-bind('token.colorText');
}
.checkbox-label input {
  width: 16px;
  height: 16px;
  cursor: pointer;
}

/* selected area */
.selected-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 6px;
  color: v-bind('token.colorText');
}
.link-clear {
  color: v-bind('token.colorError');
  cursor: pointer;
  text-decoration: none;
  transition: opacity 0.3s;
}
.link-clear:hover {
  opacity: 0.8;
}
.selected-list {
  padding: 8px 6px;
  max-height: 260px;
  overflow: auto;
}
.selected-list li {
  display: flex;
  justify-content: space-between;
  padding: 6px 0;
  color: v-bind('token.colorText');
  align-items: center;
}
.sel-remove {
  color: v-bind('token.colorError');
  cursor: pointer;
  margin-left: 12px;
  transition: opacity 0.3s;
}
.sel-remove:hover {
  opacity: 0.8;
}

/* actions */
.actions {
  display: flex;
  gap: 12px;
  justify-content: flex-end;
  padding: 12px 6px;
}
.btn {
  padding: 8px 14px;
  border-radius: 6px;
  border: none;
  cursor: pointer;
  font-weight: 600;
  transition: all 0.3s;
}
.btn-default {
  background: transparent;
  color: v-bind('token.colorText');
  border: 1px solid v-bind('token.colorBorder');
}
.btn-default:hover {
  background: v-bind('token.colorBgTextHover');
  border-color: v-bind('token.colorPrimary');
}
.btn-primary {
  background: v-bind('token.colorPrimary');
  color: #fff;
  border: none;
  box-shadow: 0 2px 6px v-bind('token.colorPrimaryBg');
}
.btn-primary:hover {
  background: v-bind('token.colorPrimaryHover');
}

/* 滚动条样式 */
.cp-body::-webkit-scrollbar,
.selected-list::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}
.cp-body::-webkit-scrollbar-thumb,
.selected-list::-webkit-scrollbar-thumb {
  background: v-bind('token.colorBgTextActive');
  border-radius: 3px;
}
.cp-body::-webkit-scrollbar-track,
.selected-list::-webkit-scrollbar-track {
  background: transparent;
}

@media (max-width: 980px) {
  .cp-modal {
    width: 92%;
  }
  .col-province,
  .col-city {
    width: 120px;
  }
  .col-district {
    width: 160px;
  }
}
</style>
