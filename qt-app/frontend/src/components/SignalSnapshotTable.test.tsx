/**
 * @file SignalSnapshotTable.test.tsx - 验证 signal snapshot groups（信号快照分组）。
 * @author PopoY
 * @created 2026-06-27
 * @brief 验证紧凑 signal snapshot groups（信号快照分组）对 scalar（标量）和 object（对象）信号项的契约。
 */

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { AntdRootProvider } from "../app/AntdRootProvider";
import {
  SignalSnapshotRefreshMeta,
  SignalSnapshotTable,
  resolveSignalRefreshPhase,
} from "./SignalSnapshotTable";

/**
 * @brief 将 signal snapshot groups（信号快照分组）渲染成 static HTML（静态 HTML），用于轻量断言。
 * @author PopoY
 * @param signalValues Driver Service（驱动服务）返回的原始 signal map（信号映射）。
 * @returns 可用于 compact contract check（紧凑契约检查）的 HTML 字符串。
 */
function renderSignalSnapshotTable(
  signalValues?: Record<string, unknown> | null,
  parameterGroupOptions?: Array<{ dictLabel: string; dictValue: string }>,
  maxSignalsPerRow?: number,
): string {
  return renderToStaticMarkup(
    <AntdRootProvider>
      <SignalSnapshotTable
        maxSignalsPerRow={maxSignalsPerRow}
        parameterGroupOptions={parameterGroupOptions}
        signalValues={signalValues}
      />
    </AntdRootProvider>,
  );
}

/**
 * @brief 将 refresh meta（刷新元信息）渲染成 static HTML（静态 HTML）。
 * @author PopoY
 * @param refreshed 是否已有成功刷新事件。
 * @returns 可断言的 HTML 字符串。
 */
function renderSignalSnapshotRefreshMeta(refreshed: boolean): string {
  return renderToStaticMarkup(
    <AntdRootProvider>
      <SignalSnapshotRefreshMeta refreshedKey={refreshed ? "cid-refresh-001" : undefined} />
    </AntdRootProvider>,
  );
}

describe("SignalSnapshotTable", () => {
  /**
   * @brief 刷新说明固定展示 10s interval（间隔），成功后先显示 success（成功）状态。
   * @author PopoY
   */
  it("renders refresh interval metadata and success status", () => {
    const html = renderSignalSnapshotRefreshMeta(true);

    expect(html).toContain("当前信号刷新间隔为10秒");
    expect(html).toContain("刷新成功");
  });

  /**
   * @brief 5s 后 refresh tag（刷新标签）从 success（成功）切换为 upcoming（即将刷新）。
   * @author PopoY
   */
  it("switches refresh status to upcoming after five seconds", () => {
    expect(resolveSignalRefreshPhase(0)).toBe("success");
    expect(resolveSignalRefreshPhase(4999)).toBe("success");
    expect(resolveSignalRefreshPhase(5000)).toBe("upcoming");
  });

  /**
   * @brief 断言不可 JSON.stringify（JSON 序列化）的 scalar（标量）仍有可读 fallback（兜底）显示。
   * @author PopoY
   */
  it("renders unsupported scalar values with readable fallback text", () => {
    const html = renderSignalSnapshotTable({
      symbol_signal: Symbol("现场状态"),
    });

    expect(html).toContain("Symbol(现场状态)");
  });

  /**
   * @brief 断言 signal snapshot（信号快照）按 paramGroup（参数组别）分组，并把 coil（线圈）0/1 展示成否/是。
   * @author PopoY
   */
  it("groups signals by paramGroup and renders coil state values as no or yes", () => {
    const html = renderSignalSnapshotTable({
      pressure_signal: {
        signalCode: "S-100",
        signalName: "压力",
        paramGroup: "液压",
        registerType: "3",
        unit: "bar",
        value: 100,
      },
      mes_ready_signal: {
        signalCode: "S-902",
        signalName: "MES通信状态",
        group: "旧组别",
        paramGroup: "状态",
        registerType: "1",
        dataType: "bit",
        value: 1,
      },
      clamp_ready_signal: {
        signalCode: "S-903",
        signalName: "夹具到位",
        paramGroup: "状态",
        registerType: "coil",
        dataType: "bit",
        value: 0,
      },
    });

    expect(html).toContain("signal-snapshot-groups");
    expect(html).toContain("液压");
    expect(html).toContain("状态");
    expect(html).toContain("2 个信号");
    expect(html).toContain("MES通信状态");
    expect(html).toContain("夹具到位");
    expect(html).toContain("是");
    expect(html).toContain("否");
    expect(html).not.toContain("旧组别");
    expect(html).not.toContain("信号编码");
  });

  /**
   * @brief 断言 paramGroup（参数组别）按 parameter_group dict（参数组别字典）翻译后再分组。
   * @author PopoY
   */
  it("translates paramGroup dict values with parameter_group options before grouping", () => {
    const html = renderSignalSnapshotTable(
      {
        press_count_signal: {
          signalCode: "S-1100",
          signalName: "下压计数",
          paramGroup: "4",
          value: 12,
        },
      },
      [{ dictValue: "4", dictLabel: "压机动作参数" }],
    );

    expect(html).toContain("压机动作参数");
    expect(html).not.toContain("4</");
  });

  /**
   * @brief 断言少量 signal group（信号分组）会按最多 6 个 signal（信号）的 row（行）上限合并展示。
   * @author PopoY
   */
  it("packs small signal groups into rows capped at six signals", () => {
    const html = renderSignalSnapshotTable({
      group_a_signal_1: {
        signalCode: "A-01",
        signalName: "A信号1",
        paramGroup: "组别A",
        value: 1,
      },
      group_a_signal_2: {
        signalCode: "A-02",
        signalName: "A信号2",
        paramGroup: "组别A",
        value: 2,
      },
      group_a_signal_3: {
        signalCode: "A-03",
        signalName: "A信号3",
        paramGroup: "组别A",
        value: 3,
      },
      group_b_signal_1: {
        signalCode: "B-01",
        signalName: "B信号1",
        paramGroup: "组别B",
        value: 1,
      },
      group_b_signal_2: {
        signalCode: "B-02",
        signalName: "B信号2",
        paramGroup: "组别B",
        value: 2,
      },
      group_c_signal_1: {
        signalCode: "C-01",
        signalName: "C信号1",
        paramGroup: "组别C",
        value: 1,
      },
      group_c_signal_2: {
        signalCode: "C-02",
        signalName: "C信号2",
        paramGroup: "组别C",
        value: 2,
      },
      group_c_signal_3: {
        signalCode: "C-03",
        signalName: "C信号3",
        paramGroup: "组别C",
        value: 3,
      },
      group_d_signal_1: {
        signalCode: "D-01",
        signalName: "D信号1",
        paramGroup: "组别D",
        value: 1,
      },
      group_d_signal_2: {
        signalCode: "D-02",
        signalName: "D信号2",
        paramGroup: "组别D",
        value: 2,
      },
      group_d_signal_3: {
        signalCode: "D-03",
        signalName: "D信号3",
        paramGroup: "组别D",
        value: 3,
      },
    });

    expect(html).toContain("signal-snapshot-group-row");
    expect(html).toContain("aria-label=\"信号分组行：组别A、组别B\"");
    expect(html).toContain("aria-label=\"信号分组行：组别C、组别D\"");
    expect(html).not.toContain("aria-label=\"信号分组行：组别C\"");
    expect(html).not.toContain("aria-label=\"信号分组行：组别D\"");
  });

  /**
   * @brief 断言 Press Working Page（压机作业页面）可把 signal row（信号行）上限提高到 7 个信号。
   * @author PopoY
   */
  it("allows callers to pack seven signals into one row", () => {
    const html = renderSignalSnapshotTable(
      {
        group_a_signal_1: {
          signalName: "A信号1",
          paramGroup: "组别A",
          value: 1,
        },
        group_a_signal_2: {
          signalName: "A信号2",
          paramGroup: "组别A",
          value: 2,
        },
        group_a_signal_3: {
          signalName: "A信号3",
          paramGroup: "组别A",
          value: 3,
        },
        group_b_signal_1: {
          signalName: "B信号1",
          paramGroup: "组别B",
          value: 1,
        },
        group_b_signal_2: {
          signalName: "B信号2",
          paramGroup: "组别B",
          value: 2,
        },
        group_b_signal_3: {
          signalName: "B信号3",
          paramGroup: "组别B",
          value: 3,
        },
        group_c_signal_1: {
          signalName: "C信号1",
          paramGroup: "组别C",
          value: 1,
        },
        group_d_signal_1: {
          signalName: "D信号1",
          paramGroup: "组别D",
          value: 1,
        },
        group_d_signal_2: {
          signalName: "D信号2",
          paramGroup: "组别D",
          value: 2,
        },
      },
      undefined,
      7,
    );

    expect(html).toContain("aria-label=\"信号分组行：组别A、组别B、组别C\"");
    expect(html).toContain("aria-label=\"信号分组行：组别D\"");
    expect(html).not.toContain("aria-label=\"信号分组行：组别A、组别B\"");
  });

  /**
   * @brief 断言紧凑信号卡能映射 object aliases（对象别名），保留组内信号但不展示 code（编码）。
   * @author PopoY
   */
  it("maps object aliases into compact grouped signal cards without showing signal codes", () => {
    const html = renderSignalSnapshotTable({
      scalar_signal: 12,
      pressure_signal: {
        signalCode: "S-02",
        signalName: "压力",
        groupName: "液压",
        unit: "bar",
        currentValue: 5,
      },
      temp_signal: {
        id: "S-03",
        name: "温度",
        parameterGroup: "环境",
        unit: "C",
        signalValue: 36.5,
      },
      speed_signal: {
        key: "S-04",
        name: "转速",
        group: "主轴",
        unit: "rpm",
        value: 1500,
      },
      state_signal: {
        code: "S-05",
        signalName: "状态",
        paramGroup: "系统",
        dataType: "boolean",
        value: true,
      },
      hidden_signal: {
        code: "S-06",
        name: "第六信号",
        value: "show",
      },
      seventh_signal: {
        code: "S-07",
        name: "第七信号",
        value: 7,
      },
      eighth_signal: {
        code: "S-08",
        name: "第八信号",
        value: 8,
      },
      ninth_signal: {
        code: "S-09",
        name: "第九信号",
        value: 9,
      },
      tenth_signal: {
        code: "S-10",
        name: "第十信号",
        value: 10,
      },
      eleventh_signal: {
        code: "S-11",
        name: "第十一信号",
        value: "skip",
      },
    });

    expect(html).toContain("signal-snapshot-groups");
    expect(html).not.toContain("信号编码");
    expect(html).not.toContain("ant-table");

    expect(html).toContain("压力");
    expect(html).toContain("液压");
    expect(html).toContain("bar");
    expect(html).toContain("5");
    expect(html).toContain("系统");
    expect(html).toContain("是");
    expect(html).not.toContain(">true<");

    expect(html).toContain("scalar_signal");
    expect(html).toContain("12");
    expect(html).toContain("第六信号");
    expect(html).toContain("第九信号");
    expect(html).toContain("第十信号");
    expect(html).toContain("第十一信号");
    expect(html).not.toContain("signal-snapshot-item__code");
    expect(html).not.toContain("S-02");
    expect(html).not.toContain("S-03");
    expect(html).not.toContain("S-04");
    expect(html).not.toContain("S-05");
    expect(html).not.toContain("S-06");
    expect(html).not.toContain("S-07");
    expect(html).not.toContain("S-08");
    expect(html).not.toContain("S-09");
    expect(html).not.toContain("S-10");
    expect(html).not.toContain("S-11");
    expect(html).not.toContain("ant-pagination");
    expect(html).not.toContain("共 11 条，仅展示前");
  });
});
