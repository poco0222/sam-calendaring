/**
 * @file PressJobHistoryPage.test.tsx - 验证 Press Job History Page（压机历史作业页面）。
 * @author PopoY
 * @created 2026-07-24 19:52:32
 * @editor PopoY
 * @edited 2026-07-27 12:38:48
 * @brief 锁定日期快照、请求竞态、表格、详情和现有 Design Token（设计变量）契约。
 */

// @ts-ignore @author PopoY: 当前项目未安装 Node types（Node 类型），测试运行时由 Vitest（测试框架）提供 node:fs。
import { existsSync, readFileSync } from "node:fs";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { AntdRootProvider } from "../app/AntdRootProvider";
import {
  alignHistoryParameters,
  buildHistoryQuery,
  createHistoryRangePresets,
  createInitialHistoryFilters,
  formatHistoryParameterValue,
  formatHistoryStatus,
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
    expect(pageSource).toContain("该作业没有可查看的操作记录");
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
   * @brief 只有后端原始 Boolean（布尔值）翻译为“是/否”，其他标量保持原样。
   * @author PopoY
   */
  it("translates only original boolean parameter values", () => {
    expect(
      formatHistoryParameterValue({
        parameterName: "自动模式",
        status: "recorded",
        value: true,
      }),
    ).toBe("是");
    expect(
      formatHistoryParameterValue({
        parameterName: "自动模式文本",
        status: "recorded",
        value: "true",
      }),
    ).toBe("true");
    expect(
      formatHistoryParameterValue({
        parameterName: "自动模式数字",
        status: "recorded",
        value: 1,
      }),
    ).toBe("1");
    expect(
      formatHistoryParameterValue({
        parameterName: "手动模式",
        status: "recorded",
        value: false,
      }),
    ).toBe("否");
  });

  /**
   * @brief 锁定查询按钮、单行筛选和六字段 operation timeline（操作时间线）契约。
   * @author PopoY
   */
  it("keeps search affordance, one-line filters, and six-field timeline contracts", () => {
    const html = renderPage();

    expect(html.replace(/\s/g, "")).toContain("查询");
    expect(pageSource).toContain("SearchOutlined");
    expect(pageSource).toContain('<SearchOutlined aria-hidden="true" />');
    expect(pageSource).toContain("presets={createHistoryRangePresets()}");
    expect(pageCss).toContain("flex-wrap: nowrap");
    expect(pageCss).toMatch(/press-job-history-page__query[\s\S]*white-space: nowrap/);
    expect(pageSource).toContain("operation.operationTime");
    expect(pageSource).toContain("operation.operationName");
    expect(pageSource).toContain("operation.result");
    expect(pageSource).toContain("内容：{formatHistoryCell(operation.content)}");
    expect(pageSource).toContain("班组：{formatHistoryCell(operation.teamName)}");
    expect(pageSource).toContain(
      "作业人员：{formatHistoryCell(operation.operatorName)}",
    );
    expect(pageCss).toContain("grid-template-columns: 12px 96px minmax(0, 1fr)");
    expect(pageCss).toContain("width: 8px");
    expect(pageCss).toContain("height: 8px");
  });

  it("uses only existing tokens for the bounded touch layout", () => {
    expect(pageCss).toContain("grid-template-rows: auto minmax(0, 1fr)");
    expect(pageCss).toContain("min-height: 44px");
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
