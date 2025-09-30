<script lang="ts" setup>
import { onMounted, reactive, ref } from 'vue';

import { Page } from '@vben/common-ui';

import { Button, Card, Select, Statistic } from 'ant-design-vue';
import dayjs from 'dayjs';

import SimpleLineChart from './SimpleLineChart.vue';

/* ==== 筛选 ==== */
const cities = ['全部', '杭州', '上海', '北京', '深圳'];
const filters = reactive({ city: '全部' });

/* ==== 顶部统计 ==== */
const overview = reactive({
  playerTotal: 3867,
  diamondConsumeTotal: 19_392,
  promoterTotal: 5,
  promoterSpreadTotal: 0,
});

/* ==== 工具 & 造数（替换成你的接口） ==== */
function rnd(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
function makeDays(n = 15) {
  const list: string[] = [];
  for (let i = n - 1; i >= 0; i--)
    list.push(dayjs().subtract(i, 'day').format('MM/DD'));
  return list;
}

/* ==== 小图数据：每日新增 / 每日充值 ==== */
const days = ref<string[]>([]);
const newUsers = ref<number[]>([]);
const recharge = ref<number[]>([]);

/* ==== 大图数据：各游戏每日消耗钻石 ==== */
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

/* ==== 拉数（演示版） ==== */
async function loadAll() {
  // 顶部统计（若有接口在此赋值）
  // overview = await api.getOverview({ city: filters.city })

  // 小图
  days.value = makeDays(15);
  newUsers.value = days.value
    .map(() => 0)
    .map((v, i, arr) => (i === arr.length - 1 ? rnd(45, 60) : v));
  recharge.value = days.value.map(() => Number((Math.random() * 1).toFixed(2)));

  // 大图
  gameDays.value = makeDays(16);
  gameSeries.value = allGames.map((name) => ({
    name,
    type: 'line',
    smooth: true,
    symbol: 'circle',
    symbolSize: 6,
    data: gameDays.value.map(() => rnd(0, 20_000)),
  }));
}

function runQuery() {
  loadAll();
}

onMounted(() => {
  runQuery();
  window.addEventListener('resize', () => {
    // SimpleLineChart 内部已处理 resize，这里无需额外代码
  });
});
</script>

<template>
  <Page auto-content-height>
    <div class="wrap">
      <!-- 顶部筛选 -->
      <div class="toolbar">
        <Select v-model:value="filters.city" style="width: 240px">
          <Select.Option v-for="c in cities" :key="c" :value="c">
            {{ c }}
          </Select.Option>
        </Select>
        <Button type="primary" @click="runQuery">确认</Button>
      </div>

      <!-- 顶部统计 -->
      <div class="stats">
        <Card size="small" class="stat">
          <Statistic title="玩家总数" :value="overview.playerTotal" />
        </Card>
        <Card size="small" class="stat">
          <Statistic
            title="钻石消耗总数"
            :value="overview.diamondConsumeTotal"
          />
        </Card>
        <Card size="small" class="stat">
          <Statistic title="推广员总数量" :value="overview.promoterTotal" />
        </Card>
        <Card size="small" class="stat">
          <Statistic
            title="推广员推广数量"
            :value="overview.promoterSpreadTotal"
          />
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

      <!-- 底部大图：各游戏每日消耗钻石 -->
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

<style scoped>
.wrap {
  padding: 16px;
}

.toolbar {
  display: flex;
  gap: 12px;
}

.stats {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
  margin-top: 12px;
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
}
</style>
