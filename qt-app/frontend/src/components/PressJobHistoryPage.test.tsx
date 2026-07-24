/**
 * @file PressJobHistoryPage.test.tsx - 验证 Press Job History Page（压机历史作业页面）。
 * @author PopoY
 * @created 2026-07-24 19:52:32
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
  createInitialHistoryFilters,
  formatHistoryStatus,
  PressJobHistoryPage,
  shouldApplyHistoryDetailResponse,
  shouldApplyHistoryListResponse,
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

  it("only applies the current list request version", () => {
    expect(shouldApplyHistoryListResponse(2, 2)).toBe(true);
    expect(shouldApplyHistoryListResponse(1, 2)).toBe(false);
  });

  it("only applies the current matching detail request and invalidates it on close", () => {
    expect(shouldApplyHistoryDetailResponse(3, 3, "job-1", "job-1")).toBe(
      true,
    );
    expect(shouldApplyHistoryDetailResponse(2, 3, "job-1", "job-1")).toBe(
      false,
    );
    expect(shouldApplyHistoryDetailResponse(3, 3, "job-1", "job-2")).toBe(
      false,
    );
    expect(shouldApplyHistoryDetailResponse(3, 4, "job-1", undefined)).toBe(
      false,
    );
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
    expect(pageSource).toContain('width="70%"');
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
