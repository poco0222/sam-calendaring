/**
 * @file PressJobHistoryPage.test.tsx - 验证 Press Job History Page（压机历史作业页面）。
 * @author PopoY
 * @created 2026-07-24 19:52:32
 * @editor PopoY
 * @edited 2026-07-29 10:13:42
 * @brief 锁定日期快照、请求竞态、表格、详情和现有 Design Token（设计变量）契约。
 */

// @ts-ignore @author PopoY: 当前项目未安装 Node types（Node 类型），测试运行时由 Vitest（测试框架）提供 node:fs。
import { existsSync, readFileSync } from "node:fs";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { AntdRootProvider } from "../app/AntdRootProvider";
import type { PressJobHistoryDetail } from "../domain/pressJob";
import {
  alignHistoryParameters,
  buildHistoryQuery,
  createHistoryRangePresets,
  createInitialHistoryFilters,
  formatHistoryParameterValue,
  formatHistoryStatus,
  HistoryDetailContent,
  PressJobHistoryPage,
  shouldApplyHistoryDetailResponse,
  shouldApplyHistoryListResponse,
  shouldRequestHistoryList,
  validateHistoryDateRange,
} from "./PressJobHistoryPage";

dayjs.extend(utc);

const pageSourceUrl = new URL("./PressJobHistoryPage.tsx", import.meta.url);
const pageSource = existsSync(pageSourceUrl)
  ? readFileSync(pageSourceUrl, "utf8")
  : "";
const pageCssUrl = new URL("./PressJobHistoryPage.css", import.meta.url);
const pageCss = existsSync(pageCssUrl) ? readFileSync(pageCssUrl, "utf8") : "";

/**
 * @brief 以固定空数据回调渲染 History Page（历史作业页）静态结构。
 * @author PopoY
 * @returns server-rendered HTML（服务端渲染 HTML）。
 */
function renderPage(): string {
  return renderToStaticMarkup(
    <AntdRootProvider>
      <PressJobHistoryPage
        craftOptions={[]}
        loadHistoryDetail={vi.fn()}
        loadHistoryList={vi.fn().mockResolvedValue({
          pageNum: 1,
          pageSize: 10,
          rows: [],
          total: 0,
        })}
        operatorOptions={[]}
      />
    </AntdRootProvider>,
  );
}

/**
 * @brief 使用真实 HistoryDetailContent（历史详情内容）渲染操作记录。
 * @author PopoY
 * @param operationRecords 固定五字段的操作记录。
 * @param parameterStates 开始与完工参数的整体状态。
 * @returns server-rendered HTML（服务端渲染 HTML）。
 */
function renderHistoryDetail(
  operationRecords: PressJobHistoryDetail["operationRecords"],
  parameterStates: Pick<
    PressJobHistoryDetail,
    "startParameterState" | "endParameterState"
  > = {
    startParameterState: "missing",
    endParameterState: "missing",
  },
): string {
  const detail: PressJobHistoryDetail = {
    moldJobId: "job-1",
    moldNo: "M-01",
    pressName: "一号压机",
    operatorId: "operator-1",
    craftCode: "craft-1",
    startedAt: "2026-07-27 11:00:00",
    completedAt: "2026-07-27 12:34:56",
    actualDurationHours: "1.5",
    status: "3",
    ...parameterStates,
    startParameters: [],
    endParameters: [],
    operationRecords,
  };

  return renderToStaticMarkup(
    <AntdRootProvider>
      <HistoryDetailContent
        craftLabelByValue={new Map([["craft-1", "冲压工艺"]])}
        detail={detail}
        operatorLabelByValue={new Map([["operator-1", "张三"]])}
      />
    </AntdRootProvider>,
  );
}

describe("PressJobHistoryPage", () => {
  it("creates the local current-day RangePicker value", () => {
    const now = dayjs("2026-07-24T13:45:00").utcOffset(480, true);

    const filters = createInitialHistoryFilters(now);

    expect(filters.dateRange[0].format("YYYY-MM-DD HH:mm:ssZ")).toBe(
      "2026-07-24 00:00:00+08:00",
    );
    expect(filters.dateRange[1].format("YYYY-MM-DD HH:mm:ssZ")).toBe(
      "2026-07-24 00:00:00+08:00",
    );
  });

  it("accepts 31 natural days and rejects 32 natural days", () => {
    const start = dayjs("2026-07-01T00:00:00").utcOffset(480, true);

    expect(validateHistoryDateRange([start, start.add(30, "day")])).toBeNull();
    expect(validateHistoryDateRange([start, start.add(31, "day")])).toBe(
      "日期范围最多选择 31 个自然日。",
    );
    expect(validateHistoryDateRange(null)).toBe("请选择日期范围。");
  });

  /**
   * @brief 锁定 1/3/7/30 个本地自然日 preset（快捷选项）的标签和闭区间。
   * @author PopoY
   */
  it("creates fresh local natural-day presets for 1, 3, 7, and 30 days", () => {
    const today = dayjs("2026-07-27T15:30:00").utcOffset(480, true);

    expect(
      createHistoryRangePresets(today).map(({ label, value }) => ({
        label,
        value: value.map((date) => date.format("YYYY-MM-DD HH:mm:ssZ")),
      })),
    ).toEqual([
      {
        label: "最近一天",
        value: ["2026-07-27 00:00:00+08:00", "2026-07-27 00:00:00+08:00"],
      },
      {
        label: "最近三天",
        value: ["2026-07-25 00:00:00+08:00", "2026-07-27 00:00:00+08:00"],
      },
      {
        label: "最近一周",
        value: ["2026-07-21 00:00:00+08:00", "2026-07-27 00:00:00+08:00"],
      },
      {
        label: "最近一月",
        value: ["2026-06-28 00:00:00+08:00", "2026-07-27 00:00:00+08:00"],
      },
    ]);
  });

  it("builds a fixed ten-row half-open query without losing local offset", () => {
    const start = dayjs("2026-07-24T00:00:00").utcOffset(480, true);

    expect(
      buildHistoryQuery(
        {
          dateRange: [start, start.add(1, "day")],
          mouldCode: " M-01 ",
          operator: "op-01",
        },
        2,
        "history-list-1",
      ),
    ).toEqual({
      correlationId: "history-list-1",
      endTime: "2026-07-26T00:00:00+08:00",
      mouldCode: "M-01",
      operator: "op-01",
      pageNum: 2,
      pageSize: 10,
      startTime: "2026-07-24T00:00:00+08:00",
    });
  });

  it("keeps the applied snapshot stable until a new page-one query is built", () => {
    const start = dayjs("2026-07-24T00:00:00").utcOffset(480, true);
    const draftFilters = {
      dateRange: [start, start] as const,
      mouldCode: "M-01",
      operator: "op-01",
    };
    const appliedQuery = buildHistoryQuery(
      draftFilters,
      4,
      "history-list-applied",
    );

    const changedDraft = { ...draftFilters, mouldCode: "M-02" };

    expect(appliedQuery.mouldCode).toBe("M-01");
    expect(
      buildHistoryQuery(changedDraft, 1, "history-list-submitted"),
    ).toMatchObject({ mouldCode: "M-02", pageNum: 1, pageSize: 10 });
  });

  it("deduplicates only the same query and list loader identity", () => {
    const query = buildHistoryQuery(
      createInitialHistoryFilters(dayjs("2026-07-24T00:00:00")),
      1,
      "history-list-identity",
    );
    const loader = vi.fn();
    const nextLoader = vi.fn();

    expect(shouldRequestHistoryList(undefined, query, loader)).toBe(true);
    expect(shouldRequestHistoryList({ query, loader }, query, loader)).toBe(
      false,
    );
    expect(shouldRequestHistoryList({ query, loader }, query, nextLoader)).toBe(
      true,
    );
  });

  it("only applies the current list request version, loader and query", () => {
    const query = buildHistoryQuery(
      createInitialHistoryFilters(dayjs("2026-07-24T00:00:00")),
      1,
      "history-list-current",
    );
    const nextQuery = { ...query, correlationId: "history-list-next" };
    const loader = vi.fn();

    expect(
      shouldApplyHistoryListResponse(2, 2, loader, loader, query, query),
    ).toBe(true);
    expect(
      shouldApplyHistoryListResponse(1, 2, loader, loader, query, query),
    ).toBe(false);
    expect(
      shouldApplyHistoryListResponse(2, 2, loader, vi.fn(), query, query),
    ).toBe(false);
    expect(
      shouldApplyHistoryListResponse(2, 2, loader, loader, query, nextQuery),
    ).toBe(false);
  });

  it("only applies the current matching detail request and loader", () => {
    const loader = vi.fn();

    expect(
      shouldApplyHistoryDetailResponse(
        3,
        3,
        "job-1",
        "job-1",
        loader,
        loader,
      ),
    ).toBe(true);
    expect(
      shouldApplyHistoryDetailResponse(
        2,
        3,
        "job-1",
        "job-1",
        loader,
        loader,
      ),
    ).toBe(false);
    expect(
      shouldApplyHistoryDetailResponse(
        3,
        3,
        "job-1",
        "job-2",
        loader,
        loader,
      ),
    ).toBe(false);
    expect(
      shouldApplyHistoryDetailResponse(
        3,
        4,
        "job-1",
        undefined,
        loader,
        loader,
      ),
    ).toBe(false);
    expect(
      shouldApplyHistoryDetailResponse(
        3,
        3,
        "job-1",
        "job-1",
        loader,
        vi.fn(),
      ),
    ).toBe(false);
  });

  it("renders the fixed filters and eight-column empty list structure", () => {
    const html = renderPage();

    expect(html).toContain("日期范围");
    expect(html).toContain("模具号");
    expect(html).toContain("作业人员");
    expect(pageSource).toContain(
      "当前查询范围暂无已完成作业，请调整日期范围后查询。",
    );
    for (const title of [
      "压机",
      "模具号",
      "作业人员",
      "工艺",
      "开始时间",
      "完成时间",
      "实际时长",
      "完工状态",
    ]) {
      expect(html).toContain(title);
    }
  });

  it("keeps the row, local state, drawer and retry source contracts", () => {
    expect(pageSource).toContain("allowClear={false}");
    expect(pageSource).toContain('size="80%"');
    expect(pageSource).not.toContain('width="80%"');
    expect(pageSource).toContain("destroyOnHidden={false}");
    expect(pageSource).toContain("tabIndex: 0");
    expect(pageSource).toContain('event.key === "Enter"');
    expect(pageSource).toContain('event.key === " "');
    expect(pageSource).toContain("历史作业加载失败，请重试。");
    expect(pageSource).toContain("作业详情加载失败，请重试。");
    expect(pageSource).toContain("detailRequestVersionRef.current += 1");
    expect(pageSource).toContain("triggerRowRef.current?.focus()");
    expect(pageSource).toContain("shouldApplyHistoryListResponse");
    expect(pageSource).toContain("shouldApplyHistoryDetailResponse");
  });

  it("invalidates requests when loader identity changes and refetches open detail", () => {
    expect(pageSource).toContain(
      "currentLoadHistoryListRef.current = loadHistoryList",
    );
    expect(pageSource).toContain(
      "currentLoadHistoryDetailRef.current = loadHistoryDetail",
    );
    expect(pageSource).toContain(
      "requestedLoader,\n              currentLoadHistoryListRef.current",
    );
    expect(pageSource).toContain(
      "requestedLoader,\n              currentLoadHistoryDetailRef.current",
    );
    expect(pageSource).toMatch(
      /useEffect\(\(\) => \{[\s\S]*detailRequestVersionRef\.current \+= 1;[\s\S]*selectedMoldJobIdRef\.current[\s\S]*runHistoryDetailRequest\(moldJobId\);[\s\S]*\}, \[loadHistoryDetail, runHistoryDetailRequest\]\);/,
    );
    expect(pageSource).not.toContain('setListStatus("loading")');
  });

  it("bridges semantic tokens to the portal drawer root", () => {
    expect(pageSource).toContain("theme.useToken()");
    expect(pageSource).toContain('"--qt-app-control-blue": colorPrimary');
    expect(pageSource).toContain(
      '"--qt-app-control-blue-soft": colorPrimaryBg',
    );
    expect(pageSource).toContain(
      '"--qt-app-control-blue-line": colorPrimaryBorder',
    );
    expect(pageSource).toContain("rootStyle={drawerRootStyle}");
  });

  it("maps unknown completion states to fixed Chinese text", () => {
    expect(formatHistoryStatus("3")).toBe("已完成");
    expect(formatHistoryStatus("UNRECOGNIZED")).toBe("状态未知");
    expect(formatHistoryStatus(undefined)).toBe("状态未知");
  });

  it("aligns parameters by name and preserves a value recorded on one side", () => {
    expect(
      alignHistoryParameters(
        [{ parameterName: "压力", status: "recorded", unit: "MPa", value: 12 }],
        [{ parameterName: "温度", status: "recorded", unit: "℃", value: 80 }],
      ),
    ).toEqual([
      {
        endValue: "未记录",
        parameterName: "压力",
        startValue: "12",
        status: "记录不完整",
        unit: "MPa",
      },
      {
        endValue: "80",
        parameterName: "温度",
        startValue: "未记录",
        status: "记录不完整",
        unit: "℃",
      },
    ]);
  });

  /**
   * @brief 只有可靠分类为 state（状态）的 0/1 与 Boolean（布尔值）翻译为“是/否”。
   * @author PopoY
   */
  it("translates only values reliably classified as state", () => {
    for (const [value, expected] of [
      [0, "否"],
      ["0", "否"],
      [false, "否"],
      [1, "是"],
      ["1", "是"],
      [true, "是"],
    ] as const) {
      expect(
        formatHistoryParameterValue({
          parameterName: "状态",
          status: "recorded",
          value,
          valueKind: "state",
        }),
      ).toBe(expected);
    }
    expect(
      formatHistoryParameterValue({
        parameterName: "普通数值",
        status: "recorded",
        value: 1,
        valueKind: "scalar",
      }),
    ).toBe("1");
    expect(
      formatHistoryParameterValue({
        parameterName: "普通布尔",
        status: "recorded",
        value: true,
        valueKind: "scalar",
      }),
    ).toBe("true");
    expect(
      formatHistoryParameterValue({
        parameterName: "状态文本",
        status: "recorded",
        value: "true",
        valueKind: "state",
      }),
    ).toBe("true");
    expect(
      alignHistoryParameters(
        [
          {
            parameterName: "就绪",
            status: "recorded",
            value: 0,
            valueKind: "state",
          },
        ],
        [
          {
            parameterName: "就绪",
            status: "recorded",
            value: 1,
            valueKind: "state",
          },
        ],
      )[0],
    ).toMatchObject({ startValue: "否", endValue: "是" });
  });

  it("paginates compact operation records and keeps only invalid parameter hints", () => {
    const html = renderHistoryDetail(
      Array.from({ length: 6 }, (_, index) => ({
        operationTime: `2026-07-27 12:0${index}:00`,
        operationName: `操作-${index + 1}`,
        result: index === 0 ? "失败" : "成功",
        teamName: index === 1 ? undefined : "夜班",
        operatorName: index === 1 ? undefined : "张三",
      })),
    );
    const operations = html.slice(html.indexOf('aria-label="操作记录"'));

    expect(operations).toContain("操作-1");
    expect(operations).toContain("操作-5");
    expect(operations).not.toContain("操作-6");
    expect(operations).toContain("班组 / 作业人员：夜班 / 张三");
    expect(operations).toContain("班组 / 作业人员：未记录 / 未记录");
    expect(operations).not.toContain("内容：");
    expect(operations).toContain("ant-timeline");
    expect(
      operations.match(
        /<li[^>]*class="[^"]*\bant-timeline-item(?=[\s"])[^"]*"/g,
      ),
    ).toHaveLength(5);
    expect(operations).toContain(
      "press-job-history-detail__operation-pagination",
    );
    expect(html).not.toContain("未记录开始参数");
    expect(html).not.toContain("未记录完工参数");

    const invalidHtml = renderHistoryDetail([], {
      startParameterState: "invalid",
      endParameterState: "invalid",
    });
    expect(invalidHtml).toContain("开始参数记录格式异常");
    expect(invalidHtml).toContain("完工参数记录格式异常");
  });

  it("renders the operation empty state in the real detail UI", () => {
    expect(renderHistoryDetail([])).toContain("该作业没有可查看的操作记录");
  });

  /**
   * @brief 锁定查询按钮、单行筛选和 operation timeline（操作时间线）布局契约。
   * @author PopoY
   */
  it("keeps search affordance, one-line filters, and timeline layout contracts", () => {
    const html = renderPage();

    expect(html.replace(/\s/g, "")).toContain("查询");
    expect(pageSource).toContain("SearchOutlined");
    expect(pageSource).toContain('<SearchOutlined aria-hidden="true" />');
    expect(pageSource).toContain("presets={createHistoryRangePresets()}");
    expect(pageCss).toContain("flex-wrap: nowrap");
    expect(pageSource).toMatch(
      /useEffect\(\(\) => \{\s*setOperationPage\(1\);\s*\}, \[detail\.moldJobId, detail\.operationRecords\]\);/,
    );
    expect(pageCss).toMatch(
      /\.press-job-history-page__field\s*\{[^}]*display: flex;[^}]*align-items: center;/,
    );
    expect(pageCss).toMatch(
      /\.press-job-history-page__query\s*\{[^}]*white-space: nowrap;[^}]*\}/,
    );
    expect(pageCss).not.toContain(
      "border-bottom: 1px solid var(--qt-app-control-blue-line)",
    );
    expect(pageCss).not.toContain("li:not(:last-child)::before");
    expect(pageCss).not.toContain(
      "press-job-history-detail__operation-marker",
    );
    expect(pageCss).toMatch(
      /\.press-job-history-detail__operation-list\s*\{[^}]*overflow: auto;/,
    );
    expect(pageCss).toMatch(
      /\.press-job-history-detail__operation-pagination\s*\{[^}]*flex: 0 0 auto;/,
    );
    expect(pageCss).toMatch(
      /\.press-job-history-detail__operation-time\s*\{[^}]*white-space: normal;[^}]*\}/,
    );
  });

  it("uses only existing tokens for the bounded touch layout", () => {
    expect(pageCss).toContain("grid-template-rows: auto minmax(0, 1fr)");
    expect(pageCss).toContain("min-height: 44px");
    expect(pageCss).toMatch(
      /\.press-job-history-page__filters\s*\{[^}]*box-sizing: border-box;[^}]*min-height: 62px;[^}]*padding: 8px 12px;/,
    );
    expect(pageCss).toMatch(
      /\.press-job-history-page__filters\s+:where\(\.ant-picker, \.ant-input, \.ant-select, \.ant-btn\)\s*\{[^}]*min-height: 44px;/,
    );
    expect(pageCss).toMatch(
      /\.press-job-history-page__filters\s+\.ant-select-selector\s*\{[^}]*min-height: 44px;/,
    );
    expect(pageCss).toContain("grid-template-columns: minmax(0, 64fr) minmax(260px, 36fr)");
    expect(pageCss).toContain(":focus-visible");
    expect(pageCss).toContain("@media (prefers-reduced-motion: reduce)");
    expect(pageCss).toContain("var(--qt-app-control-blue)");
    expect(pageCss).toContain("var(--qt-app-control-blue-soft)");
    expect(pageCss).toContain("var(--qt-app-control-blue-line)");
    expect(pageCss).not.toMatch(/#[0-9a-f]{3,8}/i);
    expect(pageCss).not.toContain("linear-gradient");
    expect(pageCss).not.toContain("box-shadow");
  });
});
