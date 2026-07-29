/**
 * @file PressJobHistoryPage.test.tsx - 验证 Press Job History Page（压机历史作业页面）。
 * @author PopoY
 * @created 2026-07-24 19:52:32
 * @editor PopoY
 * @edited 2026-07-29 17:28:56
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
import * as historyPage from "./PressJobHistoryPage";
import {
  alignHistoryParameters,
  buildHistoryQuery,
  createHistoryTeamChangeFilters,
  createHistoryRangePresets,
  createInitialHistoryFilters,
  formatHistoryParameterValue,
  formatHistoryStatus,
  HistoryDetailContent,
  PressJobHistoryPage,
  shouldApplyHistoryDetailResponse,
  shouldApplyHistoryListResponse,
  shouldApplyHistoryLookupResponse,
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
 * @brief 创建固定 History Detail（历史详情）测试数据。
 * @author PopoY
 * @param operationRecords 固定五字段的操作记录。
 * @param parameterStates 开始与完工参数的整体状态。
 * @returns 固定历史详情。
 */
function createHistoryDetail(
  operationRecords: PressJobHistoryDetail["operationRecords"],
  parameterStates: Pick<
    PressJobHistoryDetail,
    "startParameterState" | "endParameterState"
  > = {
    startParameterState: "missing",
    endParameterState: "missing",
  },
  detailOverrides: Partial<PressJobHistoryDetail> = {},
): PressJobHistoryDetail {
  return {
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
    ...detailOverrides,
  };
}

/**
 * @brief 使用真实 HistoryDetailContent（历史详情正文）渲染操作记录。
 * @author PopoY
 */
function renderHistoryDetail(
  operationRecords: PressJobHistoryDetail["operationRecords"],
  parameterStates?: Pick<
    PressJobHistoryDetail,
    "startParameterState" | "endParameterState"
  >,
  detailOverrides: Partial<PressJobHistoryDetail> = {},
): string {
  return renderToStaticMarkup(
    <AntdRootProvider>
      <HistoryDetailContent
        detail={createHistoryDetail(
          operationRecords,
          parameterStates,
          detailOverrides,
        )}
      />
    </AntdRootProvider>,
  );
}

/**
 * @brief 使用真实 HistoryDetailSummary（历史详情概要）渲染标题栏内容。
 * @author PopoY
 */
function renderHistorySummary(
  detailOverrides: Partial<PressJobHistoryDetail> = {},
): string {
  const HistoryDetailSummary = Reflect.get(
    historyPage,
    "HistoryDetailSummary",
  );
  expect(HistoryDetailSummary).toBeTypeOf("function");
  if (typeof HistoryDetailSummary !== "function") return "";

  return renderToStaticMarkup(
    <AntdRootProvider>
      <HistoryDetailSummary
        craftLabelByValue={new Map([["craft-1", "冲压工艺"]])}
        detail={createHistoryDetail([], undefined, detailOverrides)}
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

  it("defaults only the team and clears personnel when the team changes", () => {
    const filters = createInitialHistoryFilters(
      dayjs("2026-07-24T13:45:00"),
      "team-1",
    );

    expect(filters).toMatchObject({ teamId: "team-1", operator: undefined });
    expect(
      createHistoryTeamChangeFilters(
        { ...filters, mouldCode: "M-01", operator: "operator-1" },
        "team-2",
      ),
    ).toMatchObject({
      mouldCode: "M-01",
      operator: undefined,
      teamId: "team-2",
    });
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
          teamId: "team-1",
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

  it("rejects stale team and mould lookup responses", () => {
    expect(shouldApplyHistoryLookupResponse(2, 2, "team-2", "team-2")).toBe(
      true,
    );
    expect(shouldApplyHistoryLookupResponse(1, 2, "team-2", "team-2")).toBe(
      false,
    );
    expect(shouldApplyHistoryLookupResponse(2, 2, "M-01", "M-02")).toBe(
      false,
    );
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
    expect(html).toContain("班组");
    expect(html).toContain("人员");
    expect(pageSource).toContain(
      "当前查询范围暂无作业，请调整日期范围后查询。",
    );
    expect(pageSource).not.toContain("暂无已完成作业");
    for (const title of [
      "压机",
      "模具号",
      "作业人员",
      "工艺",
      "开始时间",
      "完成时间",
      "实际时长",
      "作业状态",
    ]) {
      expect(html).toContain(title);
    }
    expect(pageSource).not.toContain('label: "完工状态"');
  });

  it("scopes personnel by team while keeping the global dictionary for display", () => {
    expect(pageSource).toContain("resolveActivePressJobTeamOptions(");
    expect(pageSource).toContain("activeOperatorOptions.map");
    expect(pageSource).toContain("new Map(operatorOptions.map");
    expect(pageSource).toContain('label="班组"');
    expect(pageSource).toContain('label="人员"');
    expect(pageSource).not.toContain('label="作业人员"');
    expect(pageSource).toContain(
      "disabled={!draftFilters.teamId || loadingTeamId === draftFilters.teamId}",
    );
  });

  it("uses the mould-lock remote Select and NumericKeypad contracts", () => {
    expect(pageSource).not.toContain("<Input");
    expect(pageSource).toContain("searchPressMoldCandidates");
    expect(pageSource).toMatch(
      /createPressMoldCandidateSearchInput\(moldNo, \[\], correlationId\)/,
    );
    expect(pageSource).toContain("mouldLookupVersionRef");
    expect(pageSource).toContain("press-job-page__mold-select-popup");
    expect(pageSource).toContain("<NumericKeypad");
    expect(pageSource).toContain('specialKey="-"');
  });

  it("clears a selected mould and stops stale lookup loading when input changes", () => {
    expect(pageSource).toMatch(
      /const handleMouldCandidateChange = \(mouldCode\?: string\) => \{[\s\S]*if \(!candidate\) \{\s*pendingSelectedMouldCodeRef\.current = null;\s*handleMouldSearchTextChange\(""\);/,
    );
    expect(pageSource).toMatch(
      /const handleMouldSearchTextChange = \(nextText: string\) => \{[\s\S]*mouldLookupVersionRef\.current \+= 1;[\s\S]*setMouldCandidateLoading\(false\);[\s\S]*setMouldSearchText\(nextText\);/,
    );
    expect(pageSource).toMatch(
      /const handleMouldKeypadChange = \(nextText: string\) => \{\s*if \(!nextText\) pendingSelectedMouldCodeRef\.current = null;\s*handleMouldSearchTextChange\(nextText\);\s*\};/,
    );
    expect(pageSource).toContain("onChange={handleMouldKeypadChange}");
  });

  /**
   * @brief 断言历史筛选栏直接复用压机作业的 Form/Row/Col（表单栅格）尺寸体系，避免日期和短字段再次被压窄。
   * @author PopoY
   */
  it("reuses the press-job filter grid dimensions", () => {
    const html = renderPage();

    expect(html).toContain('aria-label="历史作业筛选区"');
    expect(pageSource).toContain('labelCol={{ flex: "72px" }}');
    expect(pageSource).toContain('wrapperCol={{ flex: "1 1 0" }}');
    expect(pageSource).toContain('gutter={12} wrap={false}');
    expect(pageSource).toContain('<Col flex="0 0 360px">');
    expect(pageSource.match(/<Col flex="0 0 220px">/g)).toHaveLength(3);
    expect(pageSource).toContain('<Col flex="auto">');
    expect(pageCss).not.toContain("flex: 0 0 270px");
    expect(pageCss).not.toContain("flex: 0 1 190px");
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

  it("formats running, completed and unknown job states", () => {
    const formatHistoryCompletedAt = Reflect.get(
      historyPage,
      "formatHistoryCompletedAt",
    ) as (status: string | undefined, value: string | undefined) => string;
    const formatHistoryDuration = Reflect.get(
      historyPage,
      "formatHistoryDuration",
    ) as (status: string | undefined, value: string | undefined) => string;

    expect(formatHistoryStatus("1")).toBe("进行中");
    expect(formatHistoryStatus("3")).toBe("已完成");
    expect(formatHistoryStatus("UNRECOGNIZED")).toBe("状态未知");
    expect(formatHistoryStatus(undefined)).toBe("状态未知");

    expect(typeof formatHistoryCompletedAt).toBe("function");
    expect(typeof formatHistoryDuration).toBe("function");
    expect(formatHistoryCompletedAt("1", undefined)).toBe("未完成");
    expect(formatHistoryCompletedAt("3", "2026-07-27 12:34:56")).toBe(
      "2026-07-27 12:34:56",
    );
    expect(formatHistoryDuration("1", undefined)).toBe("进行中");
    expect(formatHistoryDuration("3", "1.5")).toBe("1.5 小时");
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
      Array.from({ length: 11 }, (_, index) => ({
        operationTime: `2026-07-27 12:${String(index).padStart(2, "0")}:00`,
        operationName: `操作-${index + 1}`,
        result: index === 0 ? "失败" : "成功",
        teamName: index === 1 ? undefined : "夜班",
        operatorName: index === 1 ? undefined : "张三",
      })),
    );
    const operations = html.slice(html.indexOf('aria-label="操作记录"'));

    expect(operations).toContain("操作-1");
    expect(operations).toContain("操作-10");
    expect(operations).not.toContain("操作-11");
    expect(operations).toContain("班组 / 作业人员：夜班 / 张三");
    expect(operations).toContain("班组 / 作业人员：未记录 / 未记录");
    expect(operations).not.toContain("内容：");
    expect(operations).toContain("ant-timeline");
    expect(
      operations.match(
        /<li[^>]*class="[^"]*\bant-timeline-item(?=[\s"])[^"]*"/g,
      ),
    ).toHaveLength(10);
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

  it("moves the full job summary into the Drawer title and expands the body", () => {
    const summary = renderHistorySummary();

    for (const label of [
      "压机",
      "模具号",
      "作业状态",
      "实际时长",
      "班组 / 作业人员",
      "工艺",
      "开始时间",
      "完成时间",
    ]) {
      expect(summary).toContain(label);
    }
    expect(pageSource).toContain("<HistoryDetailSummary");
    expect(pageSource).toContain("title={");
    expect(
      pageSource.match(/className="press-job-history-detail__summary"/g),
    ).toHaveLength(1);
    expect(pageSource).not.toContain("press-job-history-detail__layout");
    expect(pageCss).toMatch(
      /\.press-job-history-detail \.ant-drawer-header\s*\{[^}]*padding: 8px 24px;/,
    );
    expect(pageCss).toMatch(
      /\.press-job-history-detail__body\s*\{[^}]*height: 100%;/,
    );
  });

  it("renders a running job with unfinished completion fields", () => {
    const overrides = {
      actualDurationHours: undefined,
      completedAt: undefined,
      status: "1",
    };
    const html = `${renderHistorySummary(overrides)}${renderHistoryDetail(
      [],
      undefined,
      overrides,
    )}`;

    expect(html).toContain("作业状态");
    expect(html).toContain("进行中");
    expect(html).toContain("未完成");
    expect(html).toContain("完工参数");
    expect(html).toContain("未记录");
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
      /\.press-job-history-page__filters \.ant-form-item-row\s*\{[^}]*flex-wrap: nowrap;[^}]*align-items: center;/,
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

  it("uses only existing tokens and inherits the press-job control height", () => {
    expect(pageCss).toContain("grid-template-rows: auto minmax(0, 1fr)");
    expect(pageCss).toMatch(
      /\.press-job-history-detail \.ant-drawer-body\s*\{[^}]*padding: 12px 24px;/,
    );
    expect(pageCss).toMatch(
      /\.press-job-history-detail__summary\s*\{[^}]*padding: 8px 12px;/,
    );
    expect(pageCss).toContain(
      ".press-job-history-detail__parameters .ant-spin,",
    );
    expect(pageCss).toMatch(
      /\.press-job-history-detail__parameters \.ant-table-container\s*\{[^}]*display: grid;[^}]*grid-template-rows: auto minmax\(0, 1fr\);[^}]*height: 100%;/,
    );
    expect(pageCss).toContain("min-height: 44px");
    expect(pageCss).toMatch(
      /\.press-job-history-page__filters\s*\{[^}]*box-sizing: border-box;[^}]*min-height: 62px;[^}]*padding: 8px 12px;/,
    );
    expect(pageCss).not.toMatch(
      /\.press-job-history-page__filters\s+:where\(\.ant-picker, \.ant-input, \.ant-select, \.ant-btn\)\s*\{[^}]*min-height: 44px;/,
    );
    expect(pageCss).not.toContain(
      ".press-job-history-page__filters .ant-select-selector",
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
