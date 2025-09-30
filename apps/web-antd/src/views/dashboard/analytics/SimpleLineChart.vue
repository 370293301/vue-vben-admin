<script lang="ts" setup>
import type { EChartsOption, SeriesOption } from 'echarts';

import type { EchartsUIType } from '@vben/plugins/echarts';

import { computed, onMounted, ref, watch } from 'vue';

import { EchartsUI, useEcharts } from '@vben/plugins/echarts';

const props = withDefaults(
  defineProps<{
    /** 是否填充面积 */
    area?: boolean;
    /** 系列（支持多条线/柱） */
    series?: SeriesOption[];
    /** 显示右侧图例（用于多条线） */
    showLegend?: boolean;
    /** 是否平滑曲线 */
    smooth?: boolean;
    /** 标题（可选） */
    title?: string;
    /** X 轴类目（日期/时间） */
    xData?: string[];
    /** y 轴最大值（不传自动） */
    yMax?: null | number;
  }>(),
  {
    title: '',
    xData: () => Array.from({ length: 18 }).map((_, i) => `${i + 6}:00`),
    series: () => [],
    yMax: null,
    smooth: true,
    area: false,
    showLegend: false,
  },
);

const chartRef = ref<EchartsUIType>();
const { renderEcharts } = useEcharts(chartRef);

const option = computed<EChartsOption>(() => {
  const cookedSeries = (props.series || []).map((s) => ({
    type: 'line',
    smooth: props.smooth,
    symbol: 'circle',
    symbolSize: 6,
    lineStyle: { width: 2, ...(s as any).lineStyle },
    ...(props.area ? { areaStyle: (s as any).areaStyle ?? {} } : {}),
    ...s,
  })) as SeriesOption[];

  return {
    title: props.title
      ? { text: props.title, left: 12, top: 8, textStyle: { fontSize: 14 } }
      : undefined,
    grid: {
      left: '1%',
      right: props.showLegend ? '12%' : '1%',
      top: '2%',
      bottom: 0,
      containLabel: true,
    },
    tooltip: {
      trigger: 'axis',
      axisPointer: { lineStyle: { color: '#019680', width: 1 } },
    },
    legend: props.showLegend
      ? { type: 'scroll', orient: 'vertical', right: 10, top: 32 }
      : undefined,
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: props.xData,
      axisTick: { show: false },
      splitLine: { show: true, lineStyle: { type: 'solid', width: 1 } },
    },
    yAxis: {
      type: 'value',
      max: props.yMax ?? undefined,
      splitNumber: 4,
      axisTick: { show: false },
      splitArea: { show: true },
    },
    series: cookedSeries,
  };
});

function draw() {
  renderEcharts(option.value);
}

onMounted(draw);
watch(
  () => [
    props.xData,
    props.series,
    props.yMax,
    props.smooth,
    props.area,
    props.showLegend,
  ],
  draw,
  { deep: true },
);
</script>

<template>
  <EchartsUI ref="chartRef" />
</template>
