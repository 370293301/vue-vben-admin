// src/utils/totalsThemeManager.ts
import type { Ref } from 'vue';

/**
 * 参数类型
 * - totalsTableRef: ref<HTMLTableElement | null> - 你 template 中的 totals table 的 ref
 * - vxeGridRef: ref<any> - 你的 Grid ref（可选），用于更可靠地定位 grid table
 * - columns: any[] - 你的 columns 数组（用于决定哪些列显示合计）
 * - stats: { sumDiamond: number, sumGold: number } - 包含合计数据的响应式对象
 */
export function createTotalsThemeManager(opts: {
  columns: any[];
  stats: { sumDiamond?: null | number; sumGold?: null | number };
  totalsTableRef: Ref<HTMLElement | null>;
  vxeGridRef?: null | Ref<any>;
}) {
  const { totalsTableRef, vxeGridRef = null, columns, stats } = opts;

  // timers / observers
  let resizeTimer: null | number = null;
  let themeDebounceTimer: null | number = null;
  let themeObserver: MutationObserver | null = null;
  let headerObserver: MutationObserver | null = null;

  // ---------- 辅助函数 ----------
  function getComputedStyleSafe(el: Element, pseudo?: '::after' | '::before') {
    try {
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      return pseudo ? getComputedStyle(el, pseudo) : getComputedStyle(el);
    } catch {
      return null;
    }
  }

  function isVisibleBg(cs: CSSStyleDeclaration | null) {
    if (!cs) return false;
    const bg = cs.backgroundColor || '';
    const bgImg = cs.backgroundImage || '';
    const box = cs.boxShadow || '';
    const border =
      (cs as any).borderBottom || cs.borderBottomStyle || cs.borderStyle || '';
    const bgVisible =
      !!bg && !bg.includes('rgba(0, 0, 0, 0)') && !bg.includes('transparent');
    const imgVisible = !!bgImg && bgImg !== 'none' && bgImg !== 'initial';
    const boxVisible = !!box && box !== 'none';
    const borderVisible = !!border && border !== 'none';
    return bgVisible || imgVisible || boxVisible || borderVisible;
  }

  function findBackgroundSource(startEl: Element | null) {
    let cur: Element | null = startEl;
    while (cur) {
      const beforeCs = getComputedStyleSafe(cur, '::before');
      if (isVisibleBg(beforeCs))
        return { node: cur, cs: beforeCs, via: 'pseudo-before' };
      const afterCs = getComputedStyleSafe(cur, '::after');
      if (isVisibleBg(afterCs))
        return { node: cur, cs: afterCs, via: 'pseudo-after' };

      const selfCs = getComputedStyleSafe(cur);
      if (isVisibleBg(selfCs)) return { node: cur, cs: selfCs, via: 'self' };

      cur = cur.parentElement;
    }
    return null;
  }

  // 查找 grid table 的 DOM（优先使用 vxeGridRef）
  function findGridTable(): HTMLTableElement | null {
    // 如果传入了 vxeGridRef（你的 Grid ref），优先在其 $el 内寻找
    const rootEl =
      vxeGridRef && (vxeGridRef as any).value
        ? ((vxeGridRef as any).value.$el ?? (vxeGridRef as any).value)
        : null;

    if (rootEl && (rootEl as Element).querySelector) {
      const t =
        (rootEl as Element).querySelector('table') ??
        (rootEl as Element).querySelector('table.vxe-table');
      if (t) return t as HTMLTableElement;
      // 更深层兜底
      const possible = (rootEl as Element).querySelectorAll('div,section');
      for (const el of possible) {
        const tt = (el as Element).querySelector('table');
        if (tt) return tt as HTMLTableElement;
      }
    }

    // 最后兜底：页面第一个非 totals-only 的 table
    const allTables = [...document.querySelectorAll('table')].filter(
      (t) => !t.classList.contains('totals-only'),
    );
    const firstWithThead = allTables.find((t) => t.querySelector('thead')) as
      | HTMLTableElement
      | undefined;
    return (firstWithThead ?? allTables[0]) as HTMLTableElement | null;
  }

  // ---------- 主逻辑：同步合计行样式/宽度/文本 ----------
  function syncTotalsWidths() {
    const totalsTable = totalsTableRef.value as HTMLTableElement | null;
    if (!totalsTable) return;

    const gridTable = findGridTable();
    if (!gridTable) return;

    const thead = gridTable.querySelector('thead');
    if (!thead) return;
    const headerRows = thead.querySelectorAll('tr');
    const baseRow = headerRows[headerRows.length - 1] ?? headerRows[0];
    if (!baseRow) return;
    const srcCells = [...baseRow.children] as HTMLElement[];

    // 找样本单元格（第一个可见）
    let sampleCell: HTMLElement | null = null;
    for (const c of srcCells) {
      if (c.offsetParent !== null) {
        sampleCell = c;
        break;
      }
    }
    if (!sampleCell)
      sampleCell =
        (srcCells[0] as HTMLElement) ?? (baseRow as unknown as HTMLElement);

    // 复制背景/样式（优先伪元素/祖先）
    const bgInfo = findBackgroundSource(sampleCell ?? baseRow);
    if (bgInfo && bgInfo.cs) {
      const cs = bgInfo.cs as CSSStyleDeclaration;
      if (
        (cs as any).backgroundImage &&
        (cs as any).backgroundImage !== 'none'
      ) {
        totalsTable.style.backgroundImage = (cs as any).backgroundImage;
        totalsTable.style.backgroundRepeat = (cs as any).backgroundRepeat || '';
        totalsTable.style.backgroundPosition =
          (cs as any).backgroundPosition || '';
        totalsTable.style.backgroundSize = (cs as any).backgroundSize || '';
      } else if (
        (cs as any).backgroundColor &&
        (cs as any).backgroundColor !== 'transparent' &&
        !(cs as any).backgroundColor.includes('rgba(0, 0, 0, 0)')
      ) {
        totalsTable.style.background = (cs as any).backgroundColor;
      } else {
        totalsTable.style.background = '';
      }
      totalsTable.style.boxShadow = (cs as any).boxShadow || '';
      totalsTable.style.borderBottom = (cs as any).borderBottom || '';
      // 文字颜色：优先用样本单元格 color
      const headerColor = sampleCell
        ? getComputedStyle(sampleCell).color
        : (bgInfo.cs && (bgInfo.cs as any).color) || '';
      totalsTable.querySelectorAll('th').forEach((th) => {
        (th as HTMLElement).style.color = headerColor || 'var(--vben-text-1)';
        (th as HTMLElement).style.opacity = '1';
      });
    } else {
      // fallback
      totalsTable.style.background =
        'var(--vben-header-bg, rgba(18,18,18,0.98))';
      totalsTable.style.boxShadow = '';
      totalsTable.style.borderBottom = '';
      totalsTable.querySelectorAll('th').forEach((th) => {
        (th as HTMLElement).style.color = 'var(--vben-text-1, #e6eef8)';
        (th as HTMLElement).style.opacity = '1';
      });
    }

    // 写回合计文本（保证重新渲染或其它代码未清空时仍有内容）
    const ths = [...totalsTable.querySelectorAll('th')] as HTMLElement[];
    for (const [i, th] of ths.entries()) {
      const col = Array.isArray(columns) ? (columns as any)[i] : undefined;
      const field = col ? (col.field as string) : undefined;

      switch (field) {
        case 'crystal': {
          th.textContent = String(stats.sumDiamond ?? 0);

          break;
        }
        case 'gold': {
          th.textContent = String(stats.sumGold ?? 0);

          break;
        }
        case 'contributions': {                // ✅ 新增：收益贡献
          // @ts-ignore
          th.textContent = String(stats.sumContribution ?? 0);
          break;
        }
        case 'revenue': {                      // ✅ 新增：我的收益
          // @ts-ignore
          th.textContent = String(stats.sumPayBack ?? 0);
          break;
        }
        case 'id':
        case 'pid':
        case 'uid': {
          th.textContent = '合计';
          break;
        }
        default: {
          th.innerHTML = '&nbsp;';
        }
      }
    }

    // 同步列宽（colgroup）
    const cols = totalsTable.querySelectorAll('col');
    const n = Math.min(srcCells.length, cols.length);
    for (let i = 0; i < n; i++) {
      const w = Math.max(
        1,
        Math.round(srcCells[i].getBoundingClientRect().width),
      );
      (cols[i] as HTMLTableColElement).style.width = `${w}px`;
    }

    // 总宽度 & 显示
    totalsTable.style.width = `${gridTable.getBoundingClientRect().width}px`;
    totalsTable.style.position = 'relative';
    totalsTable.style.zIndex = '5';
    totalsTable.style.display = 'table';
  }

  // 多次重试以适配异步渲染
  function trySyncWithRetries(attempts = 0) {
    // nextTick 可由调用方在外面包裹，如果需要的话
    // 这里用 setTimeout 做多次尝试
    syncTotalsWidths();
    if (attempts < 8) {
      window.setTimeout(() => trySyncWithRetries(attempts + 1), 120);
    }
  }

  // 主题/表头变化观察器（主题切换或组件内部替换 header 时触发）
  function startThemeObserver() {
    stopThemeObserver();

    // 监听 documentElement / body attribute 变化（很多框架切换主题就是改 class/data-theme）
    try {
      themeObserver = new MutationObserver(() => {
        if (themeDebounceTimer) window.clearTimeout(themeDebounceTimer);
        themeDebounceTimer = window.setTimeout(() => {
          syncTotalsWidths();
          themeDebounceTimer = null;
        }, 80) as unknown as number;
      });
      themeObserver.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ['class', 'data-theme'],
      });
      themeObserver.observe(document.body, {
        attributes: true,
        attributeFilter: ['class', 'data-theme'],
      });
    } catch {
      // ignore
    }

    // 监听 grid thead 的变化
    const gridTable = findGridTable();
    const thead = gridTable?.querySelector('thead');
    if (thead) {
      headerObserver = new MutationObserver(() => {
        if (themeDebounceTimer) window.clearTimeout(themeDebounceTimer);
        themeDebounceTimer = window.setTimeout(() => {
          syncTotalsWidths();
          themeDebounceTimer = null;
        }, 80) as unknown as number;
      });
      headerObserver.observe(thead, {
        attributes: true,
        childList: true,
        subtree: true,
      });
    }
  }

  function stopThemeObserver() {
    themeObserver?.disconnect();
    headerObserver?.disconnect();
    themeObserver = null;
    headerObserver = null;
    if (themeDebounceTimer) {
      window.clearTimeout(themeDebounceTimer);
      themeDebounceTimer = null;
    }
  }

  // window resize 绑定（节流）
  function onWinResize() {
    if (resizeTimer) window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(() => {
      syncTotalsWidths();
      resizeTimer = null;
    }, 120) as unknown as number;
  }

  // ---------- 对外 API ----------
  function start() {
    trySyncWithRetries(0);
    startThemeObserver();
    window.addEventListener('resize', onWinResize);
  }

  function stop() {
    stopThemeObserver();
    window.removeEventListener('resize', onWinResize);
    if (resizeTimer) {
      window.clearTimeout(resizeTimer);
      resizeTimer = null;
    }
  }

  function sync() {
    syncTotalsWidths();
  }

  return {
    start,
    stop,
    sync,
    trySyncWithRetries,
  };
}
