// useResponsiveColumnWidth.ts
import { ref, onMounted, onBeforeUnmount, nextTick } from 'vue';
import type { VxeGridProps } from '#/adapter/vxe-table';

interface UseResponsiveColumnWidthOptions {
  columns: VxeGridProps<any>['columns'];
  gridApi: any;
  columnField: string; // 要调整的列字段名
  mobileWidth?: number | undefined; // 手机端宽度
  pcWidth: number; // PC端宽度
  breakpoint?: number; // 断点，默认768
}

export function useResponsiveColumnWidth(options: UseResponsiveColumnWidthOptions) {
  const {
    columns,
    gridApi,
    columnField,
    mobileWidth = undefined,
    pcWidth,
    breakpoint = 768,
  } = options;

  const isMobile = ref(false);

  // 更新列宽
  function updateColumnWidth() {
    nextTick(() => {
      try {
        const targetColumn = columns.find(col => col.field === columnField);
        if (targetColumn) {
          if (isMobile.value) {
            targetColumn.width = mobileWidth;
            targetColumn.minWidth = 100;
          } else {
            targetColumn.width = pcWidth;
            targetColumn.minWidth = undefined;
          }
        }

        if (gridApi && gridApi.reload) {
          setTimeout(() => {
            gridApi.reload();
          }, 100);
        }
      } catch (error) {
        console.error('[updateColumnWidth] 错误:', error);
      }
    });
  }

  // 窗口大小变化处理
  function handleResize() {
    const newIsMobile = window.innerWidth <= breakpoint;

    if (isMobile.value !== newIsMobile) {
      isMobile.value = newIsMobile;
      updateColumnWidth();
    }
  }

  // 生命周期
  onMounted(() => {
    isMobile.value = window.innerWidth <= breakpoint;
    window.addEventListener('resize', handleResize);

    nextTick(() => {
      updateColumnWidth();
    });
  });

  onBeforeUnmount(() => {
    window.removeEventListener('resize', handleResize);
  });

  return {
    isMobile,
    updateColumnWidth,
  };
}
