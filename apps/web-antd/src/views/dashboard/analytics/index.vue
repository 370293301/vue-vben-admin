<template>
  <Page auto-content-height>
    <div class="wrap">
      <!-- 顶部筛选 -->
      <div class="toolbar">
        <!-- 原生输入（不依赖 a-input） -->
        <input
          readonly
          :value="filters.city"
          placeholder="请选择城市（点击展开）"
          class="city-input"
          @click="openPicker"
        />
        <Button type="primary" @click="runQuery">确认</Button>
      </div>

      <!-- 使用你自定义的 CityPicker（请确保组件路径正确） -->
      <CityPicker
        v-model:visible="pickerVisible"
        v-model:selected="selectedCityIds"
        :cities="citiesData"
        @confirm="onConfirm"
        @cancel="onCancel"
      />

      <!-- 统计卡片 -->
      <div class="stats">
        <Card size="small" class="stat">
          <Statistic title="玩家总数" :value="overview.playerTotal" />
        </Card>
        <Card size="small" class="stat">
          <Statistic title="钻石消耗总数" :value="overview.diamondConsumeTotal" />
        </Card>
        <Card size="small" class="stat">
          <Statistic title="推广员总数量" :value="overview.promoterTotal" />
        </Card>
        <Card size="small" class="stat">
          <Statistic title="推广员推广数量" :value="overview.promoterSpreadTotal" />
        </Card>
      </div>

      <!-- 两个小图 -->
      <div class="row">
        <Card size="small" class="chartCard">
          <SimpleLineChart
            title="每日新增用户"
            :x-data="days"
            :series="[{ name: '新增', data: newUsers }]"
            :y-max="60"
            :area="false"
            :smooth="true"
          />
        </Card>
        <Card size="small" class="chartCard">
          <SimpleLineChart
            title="每日充值金额"
            :x-data="days"
            :series="[{ name: '充值金额(千元)', data: recharge }]"
            :area="false"
            :smooth="true"
          />
        </Card>
      </div>

      <!-- 大图 -->
      <Card size="small" class="bigCard">
        <SimpleLineChart
          title="各游戏每日消耗钻石"
          :x-data="gameDays"
          :series="gameSeries"
          :show-legend="true"
          :area="false"
          :smooth="true"
        />
      </Card>
    </div>
  </Page>
</template>

<script lang="ts" setup>
import { onMounted, reactive, ref, computed, watch } from 'vue';
import { Page } from '@vben/common-ui';
import { Button, Card, Statistic } from 'ant-design-vue';
import dayjs from 'dayjs';

// 本目录下的轻量折线图组件（如果你希望用 echarts，请自行替换为 echarts 版）
import SimpleLineChart from './SimpleLineChart.vue';

// 你自定义的 CityPicker（路径按你项目实际位置调整）
import CityPicker from '#/components/CityPicker.vue';
// 城市 JSON（路径按你项目实际位置调整）
import citiesData from '#/data/cities.json';

function onConfirm(list: any[]) {
  console.log('用户确认：', list);
}
function onCancel() {
  console.log('取消');
}

/* ==== 城市筛选（父端） ==== */
interface CityNode { id:number; name:string; level:number; children?:CityNode[]; pid?:number; }
const selectedCityIds = ref<number[]>([]);
const pickerVisible = ref(false);
const cityId = ref<string>('');
const filters = reactive<{ city: string | '' }>({ city: '' });

const thirdLevelCities = computed(() => {
  const list: CityNode[] = [];
  if (!Array.isArray(citiesData)) return list;
  for (const prov of citiesData as CityNode[]) {
    if (!prov.children) continue;
    for (const city of prov.children) {
      if (!city.children) continue;
      for (const node of city.children) {
        if (node.level === 3) list.push(node);
      }
    }
  }
  return list;
});

watch(selectedCityIds, (newIds) => {
  if (!newIds || newIds.length === 0) {
    filters.city = '';
    cityId.value = '';
    return;
  }
  const names: string[] = [];
  const idSet = new Set(newIds);
  for (const node of thirdLevelCities.value) {
    if (idSet.has(node.id)) names.push(node.name);
  }
  filters.city = names.join(',');
  cityId.value = newIds.join(',');
});

/* ==== 其它不变的逻辑（统计、造数等） ==== */
const overview = reactive({
  playerTotal: 3867,
  diamondConsumeTotal: 19392,
  promoterTotal: 5,
  promoterSpreadTotal: 0,
});

function rnd(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
function makeDays(n = 15) {
  const list: string[] = [];
  for (let i = n - 1; i >= 0; i--)
    list.push(dayjs().subtract(i, 'day').format('MM/DD'));
  return list;
}

const days = ref<string[]>([]);
const newUsers = ref<number[]>([]);
const recharge = ref<number[]>([]);
const gameDays = ref<string[]>([]);
const gameSeries = ref<any[]>([]);
const allGames = [
  '安庆保皇',
  '德堡',
  '掼三张',
  '安庆搓跑快',
  '枞阳跑得快',
  '比拼扑克',
];

async function loadAll() {
  days.value = makeDays(15);
  newUsers.value = days.value
    .map(() => 0)
    .map((v, i, arr) => (i === arr.length - 1 ? rnd(45, 60) : v));
  recharge.value = days.value.map(() => Number((Math.random() * 1).toFixed(2)));

  gameDays.value = makeDays(16);
  gameSeries.value = allGames.map((name) => ({
    name,
    type: 'line',
    smooth: true,
    symbol: 'circle',
    symbolSize: 6,
    data: gameDays.value.map(() => rnd(0, 20000)),
  }));
}

function runQuery() {
  loadAll();
}

function openPicker() {
  pickerVisible.value = true;
}

onMounted(() => {
  runQuery();
});
</script>

<style scoped>
.wrap {
  padding: 16px;
}
.toolbar {
  display: flex;
  gap: 12px;
  align-items: center;
  margin-bottom: 12px;
}
.city-input {
  width: 360px;
  padding: 8px 10px;
  border-radius: 6px;
  border: 1px solid rgba(0,0,0,0.08);
  background: white;
}
.stats {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
  margin-top: 0;
}
.stat :deep(.ant-statistic-title) {
  font-size: 13px;
  color: #666;
}
.row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  margin-top: 12px;
}
.chartCard {
  min-height: 260px;
}
.bigCard {
  margin-top: 12px;
  min-height: 320px;
}
</style>
