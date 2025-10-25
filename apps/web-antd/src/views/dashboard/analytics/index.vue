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
          <Statistic title="玩家总数" :value="overview.playerNum" />
        </Card>
        <Card size="small" class="stat">
          <Statistic title="钻石消耗总数" :value="overview.costDiamondNum" />
        </Card>
        <Card size="small" class="stat">
          <Statistic title="推广员总数量" :value="overview.agentNum" />
        </Card>
        <Card size="small" class="stat">
          <Statistic title="下级推广员数量" :value="overview.agentToPlayerNum" />
        </Card>
        <Card size="small" class="stat">
          <Statistic title= "实时在线人数" :value="overview.onLineNum" />
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
import gameTypeData from '#/data/gametype.json';
import { agentMainInfo } from '#/api/account';
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
  playerNum: 0,          // ✅ 玩家总数
  costDiamondNum: 0,     // ✅ 钻石消耗总数
  agentNum: 0,           // ✅ 推广员总数
  agentToPlayerNum: 0,   // ✅ 下级推广员数量
  onLineNum: 0,          // ✅ 实时在线人数（新增）
});
/**
 * 获取游戏类型名称
 * @param gameType 游戏类型ID
 * @returns 游戏名称
 */
function getGameTypeName(gameType: number | string): string {
  const game = gameTypeData[String(gameType)];
  return game ? game.Name_1 : `游戏${gameType}`;
}
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


/**
 * 加载首页数据
 */
async function loadMainData() {
  try {
    const agentPid = localStorage.getItem('AGENT_PID') || '';

    console.log('[agentMainInfo] 请求参数 requestPid:', agentPid);

    const response = await agentMainInfo({
      requestPid: agentPid,
    });

    console.log('[agentMainInfo] 响应:', response);

    const data = response?.data;
    if (!data) {
      console.error('[agentMainInfo] 没有数据');
      return;
    }

    // ✅ 更新统计卡片数据
    overview.playerNum = data.playerNum ?? 0;
    overview.costDiamondNum = data.costDiamondNum ?? 0;
    overview.agentNum = data.agentNum ?? 0;
    overview.agentToPlayerNum = data.agentToPlayerNum ?? 0;
    overview.onLineNum = data.onLineNum ?? 0;

    // ✅ 处理每日新增用户数据
    if (Array.isArray(data.dailyNewPlayerNum)) {
      const sortedDailyNew = data.dailyNewPlayerNum.sort((a: any, b: any) => {
        return a.dateTime.localeCompare(b.dateTime);
      });
      days.value = sortedDailyNew.map((item: any) => {
        const dateStr = String(item.dateTime || '').trim();

        // ✅ 调试：打印原始日期
        console.log('[dailyNewPlayerNum] 原始日期:', dateStr);

        // ✅ 尝试多种格式
        let date = dayjs(dateStr, 'YYYYMMDD');
        if (!date.isValid()) {
          date = dayjs(dateStr, 'YYYY-MM-DD');
        }
        if (!date.isValid()) {
          date = dayjs(dateStr);
        }

        // ✅ 如果还是无效，使用默认值或返回原始字符串
        if (!date.isValid()) {
          console.warn('[dailyNewPlayerNum] 无效日期:', dateStr);
          return dateStr || '未知日期'; // 返回原始字符串，不显示 Invalid Date
        }

        return date.format('MM/DD');
      });
      console.log('[dailyNewPlayerNum] 处理后的日期:', days.value);
    }

// ✅ 处理每日充值金额数据
    if (Array.isArray(data.familyDailyRecharge)) {
      const sortedRecharge = data.familyDailyRecharge.sort((a: any, b: any) => {
        return a.dateTime.localeCompare(b.dateTime);
      });
      recharge.value = sortedRecharge.map((item: any) => {
        const totalRecharge = item.totalRecharge ?? 0;
        return Number((totalRecharge / 100).toFixed(2));
      });
    }

// ✅ 处理游戏消耗钻石数据
    if (Array.isArray(data.gameTypeDailyConsume)) {
      // 按日期分组
      const grouped: { [key: string]: { [key: number]: number } } = {};

      for (const item of data.gameTypeDailyConsume) {
        const dateTime = String(item.dateTime || '').trim();
        const gameType = item.gameType;
        const totalConsume = item.totalConsume ?? 0;

        // ✅ 调试：打印原始日期
        console.log('[gameTypeDailyConsume] 原始日期:', dateTime, '游戏类型:', gameType);

        if (!dateTime || !gameType) {
          console.warn('[gameTypeDailyConsume] 日期或游戏类型为空', item);
          continue;
        }

        if (!grouped[dateTime]) {
          grouped[dateTime] = {};
        }
        grouped[dateTime][gameType] = totalConsume;
      }

      // 获取所有日期并排序
      const allDates = Object.keys(grouped).sort();
      gameDays.value = allDates.map((date) => {
        console.log('[gameTypeDailyConsume] 处理日期:', date);

        // ✅ 尝试多种格式
        let d = dayjs(date, 'YYYYMMDD');
        if (!d.isValid()) {
          d = dayjs(date, 'YYYY-MM-DD');
        }
        if (!d.isValid()) {
          d = dayjs(date);
        }

        // ✅ 如果还是无效，返回原始值
        if (!d.isValid()) {
          console.warn('[gameTypeDailyConsume] 无效日期:', date);
          return date || '未知'; // 返回原始字符串
        }

        return d.format('MM/DD');
      });

      console.log('[gameTypeDailyConsume] 处理后的日期:', gameDays.value);

      // 获取所有游戏类型
      const allGameTypes = new Set<number>();
      for (const dateData of Object.values(grouped)) {
        for (const gameType of Object.keys(dateData)) {
          allGameTypes.add(Number(gameType));
        }
      }

      // 构建系列数据
      gameSeries.value = Array.from(allGameTypes)
        .sort()
        .map((gameType) => ({
          name: getGameTypeName(gameType),
          type: 'line',
          smooth: true,
          symbol: 'circle',
          symbolSize: 6,
          data: allDates.map((date) => grouped[date][gameType] ?? 0),
        }));

      console.log('[gameTypeDailyConsume] 处理后的系列:', gameSeries.value);
    }
  } catch (error: any) {
    console.error('[loadMainData] 错误:', error);
  }
}

function runQuery() {
  loadMainData();
}


onMounted(() => {
  runQuery();
});

function openPicker() {
  pickerVisible.value = true;
}


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
  grid-template-columns: repeat(5, 1fr);
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
