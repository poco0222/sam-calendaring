/**
 * @file SignalSnapshotTable.tsx - 渲染 signal snapshot groups（信号快照分组）。
 * @author PopoY
 * @created 2026-06-25
 * @brief 渲染 Driver Service（驱动服务）signal snapshot（信号快照）的紧凑只读分组卡片。
 */

import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { BorderBeam, Space, Tag, Typography } from "antd";
import type { BorderBeamGradient } from "antd";
import type { ParameterGroupOption } from "../domain/lease";

type SignalItem = {
  key: string;
  name: string;
  group: string;
  unit: string;
  registerType: string;
  dataType: string;
  value: unknown;
};

type SignalGroup = {
  name: string;
  items: SignalItem[];
};

type SignalGroupRow = {
  key: string;
  groups: SignalGroup[];
  signalCount: number;
};

type SignalGroupLayoutStyle = CSSProperties & {
  "--signal-row-columns"?: string;
  "--signal-group-span"?: string;
  "--signal-group-columns"?: string;
};

const EMPTY_SIGNAL_CELL = "--";
const DEFAULT_MAX_SIGNALS_PER_GROUP_ROW = 6;
const SIGNAL_REFRESH_INTERVAL_SECONDS = 10;
const SIGNAL_REFRESH_SUCCESS_VISIBLE_MS = 5000;
const UNGROUPED_SIGNAL_GROUP = "未分组";
// @author PopoY: 采用 Ant Design 官网 Nebula（星云）配色，贴近公司 logo（标志）的蓝紫粉组合。
const NEBULA_BORDER_BEAM_COLOR: BorderBeamGradient = [
  { color: "#2f54eb", percent: 0 },
  { color: "#722ed1", percent: 44 },
  { color: "#ff85c0", percent: 100 },
];

/**
 * @brief 定义 signal snapshot groups（信号快照分组）接收的 props（属性）。
 * @author PopoY
 */
export type SignalSnapshotTableProps = {
  maxSignalsPerRow?: number;
  parameterGroupOptions?: ParameterGroupOption[];
  signalValues?: Record<string, unknown> | null;
};

type SignalRefreshPhase = "success" | "upcoming";

/**
 * @brief 定义 signal refresh meta（信号刷新元信息）的 props（属性）。
 * @author PopoY
 */
export type SignalSnapshotRefreshMetaProps = {
  refreshedKey?: string;
};

/**
 * @brief 根据 elapsed time（已过时间）判断刷新 tag（标签）展示阶段。
 * @author PopoY
 * @param elapsedMs 距离最近一次成功刷新的毫秒数。
 * @returns 5s 内为 success（成功），之后为 upcoming（即将刷新）。
 */
export function resolveSignalRefreshPhase(elapsedMs: number): SignalRefreshPhase {
  return elapsedMs < SIGNAL_REFRESH_SUCCESS_VISIBLE_MS ? "success" : "upcoming";
}

/**
 * @brief 渲染 signal refresh interval（信号刷新间隔）说明和 refresh status tag（刷新状态标签）。
 * @author PopoY
 * @param props 最近一次成功刷新的 stable key（稳定键）。
 * @returns 可放在 section header（区块标题栏）右侧的 React element（React 元素）。
 */
export function SignalSnapshotRefreshMeta({
  refreshedKey,
}: SignalSnapshotRefreshMetaProps) {
  const [refreshPhase, setRefreshPhase] = useState<SignalRefreshPhase>(
    refreshedKey ? "success" : "upcoming",
  );

  useEffect(() => {
    if (!refreshedKey) {
      setRefreshPhase("upcoming");
      return;
    }

    setRefreshPhase("success");
    // @author PopoY: 10s refresh interval（刷新间隔）内，前 5s 展示 success（成功），后 5s 提醒即将刷新。
    const timerId = window.setTimeout(() => {
      setRefreshPhase("upcoming");
    }, SIGNAL_REFRESH_SUCCESS_VISIBLE_MS);

    return () => {
      window.clearTimeout(timerId);
    };
  }, [refreshedKey]);

  return (
    <Space className="signal-snapshot-refresh-meta" size={8}>
      <Typography.Text className="signal-snapshot-refresh-meta__text" type="secondary">
        当前信号刷新间隔为{SIGNAL_REFRESH_INTERVAL_SECONDS}秒
      </Typography.Text>
      <Tag color={refreshPhase === "success" ? "success" : "processing"}>
        {refreshPhase === "success" ? "刷新成功" : "即将刷新"}
      </Tag>
    </Space>
  );
}

/**
 * @brief 渲染紧凑 signal snapshot groups（信号快照分组），并安全映射 scalar（标量）和 object（对象）载荷。
 * @author PopoY
 * @param props Driver Service（驱动服务）返回的 snapshot value map（快照值映射）。
 * @returns signal snapshot（信号快照）区块主体的 React element（React 元素）。
 */
export function SignalSnapshotTable({
  maxSignalsPerRow = DEFAULT_MAX_SIGNALS_PER_GROUP_ROW,
  parameterGroupOptions = [],
  signalValues,
}: SignalSnapshotTableProps) {
  // PopoY: caller（调用方）可按容器空间提高 row density（行密度），默认保持 dashboard（仪表盘）6 个信号。
  const normalizedMaxSignalsPerRow = normalizeMaxSignalsPerRow(maxSignalsPerRow);
  const groups = buildSignalGroups(signalValues, parameterGroupOptions);
  const groupRows = packSignalGroupsIntoRows(groups, normalizedMaxSignalsPerRow);

  if (groups.length === 0) {
    return (
      <Typography.Text type="secondary">
        暂无信号快照数据。
      </Typography.Text>
    );
  }

  return (
    <div className="signal-snapshot-table signal-snapshot-groups" aria-label="信号快照分组">
      {groupRows.map((row) => (
        <div
          aria-label={formatSignalGroupRowLabel(row)}
          className="signal-snapshot-group-row"
          key={row.key}
          style={createSignalRowStyle(row, normalizedMaxSignalsPerRow)}
        >
          {row.groups.map((group) => (
            <BorderBeam color={NEBULA_BORDER_BEAM_COLOR} key={group.name} outset={0}>
              <section
                className="signal-snapshot-group"
                style={createSignalGroupStyle(group, normalizedMaxSignalsPerRow)}
              >
                <header className="signal-snapshot-group__header">
                  <Typography.Text className="signal-snapshot-group__title" strong>
                    {group.name}
                  </Typography.Text>
                  <Tag>{group.items.length} 个信号</Tag>
                </header>
                <div className="signal-snapshot-group__grid">
                  {group.items.map((item) => (
                    <article className="signal-snapshot-item" key={item.key}>
                      <div className="signal-snapshot-item__meta">
                        <span className="signal-snapshot-item__name" title={item.name}>
                          {item.name}
                        </span>
                      </div>
                      <div className="signal-snapshot-item__value">
                        {renderSignalValue(item)}
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            </BorderBeam>
          ))}
        </div>
      ))}
    </div>
  );
}

/**
 * @brief 将 signal map（信号映射）转换为按参数组别聚合的 signal group（信号组）。
 * @author PopoY
 * @param signalValues Driver Service response（驱动服务响应）中的原始信号值。
 * @returns 适合 React（React）和 static test（静态测试）输出的有序分组。
 */
function buildSignalGroups(
  signalValues?: Record<string, unknown> | null,
  parameterGroupOptions: ParameterGroupOption[] = [],
): SignalGroup[] {
  if (!signalValues) {
    return [];
  }

  const groups = new Map<string, SignalItem[]>();

  for (const [signalKey, value] of Object.entries(signalValues)) {
    const item = buildSignalItem(signalKey, value, parameterGroupOptions);
    const groupItems = groups.get(item.group) ?? [];

    groupItems.push(item);
    groups.set(item.group, groupItems);
  }

  return [...groups.entries()].map(([name, items]) => ({ name, items }));
}

/**
 * @brief 将少量 signal group（信号分组）顺序装入 row（行），每行最多使用调用方指定数量的 signal（信号）。
 * @author PopoY
 * @param groups 已按参数组别聚合的 signal group（信号分组）。
 * @param maxSignalsPerRow 每行允许展示的最大 signal（信号）数量。
 * @returns 可直接驱动 dashboard grid（仪表盘栅格）的 row（行）列表。
 */
function packSignalGroupsIntoRows(
  groups: SignalGroup[],
  maxSignalsPerRow: number,
): SignalGroupRow[] {
  const rows: SignalGroupRow[] = [];
  let currentGroups: SignalGroup[] = [];
  let currentSignalCount = 0;

  const flushCurrentRow = () => {
    if (currentGroups.length === 0) {
      return;
    }

    rows.push({
      key: currentGroups.map((group) => group.name).join("|"),
      groups: currentGroups,
      signalCount: currentSignalCount,
    });
    currentGroups = [];
    currentSignalCount = 0;
  };

  for (const group of groups) {
    const groupSignalCount = group.items.length;

    if (
      currentGroups.length > 0 &&
      currentSignalCount + groupSignalCount > maxSignalsPerRow
    ) {
      flushCurrentRow();
    }

    currentGroups.push(group);
    currentSignalCount += groupSignalCount;

    if (currentSignalCount >= maxSignalsPerRow) {
      flushCurrentRow();
    }
  }

  flushCurrentRow();

  return rows;
}

/**
 * @brief 创建 signal group row（信号分组行）的 a11y（无障碍）标签。
 * @author PopoY
 * @param row 已装箱的 signal group row（信号分组行）。
 * @returns 描述该 row（行）包含哪些 group（分组）的中文标签。
 */
function formatSignalGroupRowLabel(row: SignalGroupRow): string {
  return `信号分组行：${row.groups.map((group) => group.name).join("、")}`;
}

/**
 * @brief 生成 row grid（行栅格）列数，确保单行不超过调用方指定的 signal（信号）数量。
 * @author PopoY
 * @param row 已装箱的 signal group row（信号分组行）。
 * @param maxSignalsPerRow 每行允许展示的最大 signal（信号）数量。
 * @returns React style（React 样式）使用的 CSS custom properties（CSS 自定义属性）。
 */
function createSignalRowStyle(
  row: SignalGroupRow,
  maxSignalsPerRow: number,
): SignalGroupLayoutStyle {
  return {
    "--signal-row-columns": String(
      Math.min(row.signalCount, maxSignalsPerRow),
    ),
  };
}

/**
 * @brief 生成 group grid（分组栅格）跨度，让 3+2 这类小 group（小分组）能共享同一行。
 * @author PopoY
 * @param group 当前 signal group（信号分组）。
 * @param maxSignalsPerRow 每行允许展示的最大 signal（信号）数量。
 * @returns React style（React 样式）使用的 CSS custom properties（CSS 自定义属性）。
 */
function createSignalGroupStyle(
  group: SignalGroup,
  maxSignalsPerRow: number,
): SignalGroupLayoutStyle {
  const signalColumns = Math.min(group.items.length, maxSignalsPerRow);

  return {
    "--signal-group-columns": String(signalColumns),
    "--signal-group-span": String(signalColumns),
  };
}

/**
 * @brief 归一化 maxSignalsPerRow（每行最大信号数），避免异常 prop（属性）破坏 grid（栅格）。
 * @author PopoY
 * @param maxSignalsPerRow 调用方传入的每行最大 signal（信号）数量。
 * @returns 至少为 1 的整数。
 */
function normalizeMaxSignalsPerRow(maxSignalsPerRow: number): number {
  if (!Number.isFinite(maxSignalsPerRow)) {
    return DEFAULT_MAX_SIGNALS_PER_GROUP_ROW;
  }

  return Math.max(1, Math.floor(maxSignalsPerRow));
}

/**
 * @brief 将单个 signal entry（信号条目）归一化为工控机面板使用的紧凑行契约。
 * @author PopoY
 * @param signalKey 原始 snapshot map（快照映射）中的 fallback key（兜底键）。
 * @param rawValue scalar（标量）或 object（对象）信号载荷。
 * @param parameterGroupOptions ERP parameter_group dict（参数组别字典）选项。
 * @returns 包含 operator-safe（操作员安全）展示字段的紧凑信号项。
 */
function buildSignalItem(
  signalKey: string,
  rawValue: unknown,
  parameterGroupOptions: ParameterGroupOption[],
): SignalItem {
  if (!isPlainObject(rawValue)) {
    return {
      key: signalKey,
      name: signalKey,
      group: UNGROUPED_SIGNAL_GROUP,
      unit: "",
      registerType: "",
      dataType: "",
      value: rawValue,
    };
  }

  const name = pickFirstDefinedString(rawValue, ["name", "signalName"]);
  const group = pickFirstDefinedString(rawValue, [
    "paramGroup",
    "parameterGroup",
    "groupName",
    "group",
  ]);
  const unit = pickFirstDefinedString(rawValue, ["unit"]);
  const registerType = pickFirstDefinedString(rawValue, ["registerType", "type"]);
  const dataType = pickFirstDefinedString(rawValue, ["dataType"]);
  const value = pickFirstDefinedValue(rawValue, ["value", "currentValue", "signalValue"]);

  return {
    key: signalKey,
    name: name || signalKey,
    group: translateParameterGroup(group, parameterGroupOptions) || UNGROUPED_SIGNAL_GROUP,
    unit,
    registerType,
    dataType,
    value: value === undefined ? rawValue : value,
  };
}

/**
 * @brief 按 sam-erp parameter_group dict（参数组别字典）把 dictValue（字典值）翻译成 dictLabel（字典标签）。
 * @author PopoY
 * @param group 原始 paramGroup（参数组别）值。
 * @param parameterGroupOptions ERP 字典选项列表。
 * @returns 命中字典时返回中文标签，否则返回原始值。
 */
function translateParameterGroup(
  group: string,
  parameterGroupOptions: ParameterGroupOption[],
): string {
  const option = parameterGroupOptions.find(
    (item) => item.dictValue === group,
  );

  return option?.dictLabel || group;
}

/**
 * @brief 检查 runtime value（运行时值）是否可作为 plain object（普通对象）参与别名映射。
 * @author PopoY
 * @param value snapshot payload（快照载荷）中的 unknown（未知）运行时值。
 * @returns 当值可视为 key-value object（键值对象）时返回 true。
 */
function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * @brief 从 object alias list（对象别名列表）中选择第一个可字符串化字段用于紧凑展示。
 * @author PopoY
 * @param value 原始 object payload（对象载荷）。
 * @param keys 按业务优先级排序的 alias keys（别名键）。
 * @returns 字符串值，所有别名缺失时返回空字符串。
 */
function pickFirstDefinedString(
  value: Record<string, unknown>,
  keys: string[],
): string {
  const matchedValue = pickFirstDefinedValue(value, keys);

  if (matchedValue === undefined || matchedValue === null) {
    return "";
  }

  return String(matchedValue);
}

/**
 * @brief 从 object alias list（对象别名列表）中选择第一个已定义字段，并保留 runtime type（运行时类型）。
 * @author PopoY
 * @param value 原始 object payload（对象载荷）。
 * @param keys 按业务优先级排序的 alias keys（别名键）。
 * @returns 第一个已定义字段值，未命中时返回 undefined（未定义）。
 */
function pickFirstDefinedValue(
  value: Record<string, unknown>,
  keys: string[],
): unknown {
  for (const key of keys) {
    if (key in value && value[key] !== undefined) {
      return value[key];
    }
  }

  return undefined;
}

/**
 * @brief 渲染单个 signal value（信号值），并把状态类 0/1 转换为中文是/否。
 * @author PopoY
 * @param item 已归一化的 signal item（信号项）。
 * @returns React node（React 节点）形式的可读值。
 */
function renderSignalValue(item: SignalItem): ReactNode {
  if (isStateSignal(item)) {
    const stateText = formatStateValue(item.value);

    if (stateText) {
      return <Tag color={stateText === "是" ? "success" : "default"}>{stateText}</Tag>;
    }
  }

  const formattedValue = formatUnknownValue(item.value);

  return (
    <span className="signal-snapshot-item__value-text" title={formattedValue}>
      {formattedValue}
      {item.unit ? (
        <span className="signal-snapshot-item__unit">{item.unit}</span>
      ) : null}
    </span>
  );
}

/**
 * @brief 判断 signal item（信号项）是否是 coil（线圈）或 bit（位）状态量。
 * @author PopoY
 * @param item 已归一化的 signal item（信号项）。
 * @returns 是状态量时返回 true。
 */
function isStateSignal(item: SignalItem): boolean {
  const registerType = normalizeSignalToken(item.registerType);
  const dataType = normalizeSignalToken(item.dataType);

  return (
    registerType === "1" ||
    registerType === "coil" ||
    registerType === "coils" ||
    dataType === "bit" ||
    dataType === "bool" ||
    dataType === "boolean"
  );
}

/**
 * @brief 格式化 state value（状态值），单值 0/1 输出否/是，多值数组输出紧凑中文序列。
 * @author PopoY
 * @param value coil（线圈）或 bit（位）信号返回值。
 * @returns 可展示的中文状态文本，无法识别时返回空字符串。
 */
function formatStateValue(value: unknown): string {
  if (Array.isArray(value)) {
    const labels = value.map(formatSingleStateValue);

    return labels.every(Boolean) ? labels.join(" / ") : "";
  }

  return formatSingleStateValue(value);
}

/**
 * @brief 格式化单个 0/1 state value（状态值）。
 * @author PopoY
 * @param value coil（线圈）或 bit（位）单点值。
 * @returns 0 显示否，1 显示是，其他值返回空字符串。
 */
function formatSingleStateValue(value: unknown): string {
  if (value === 0 || value === "0" || value === false) {
    return "否";
  }

  if (value === 1 || value === "1" || value === true) {
    return "是";
  }

  return "";
}

/**
 * @brief 归一化 signal metadata token（信号元数据标记）用于显示分支判断。
 * @author PopoY
 * @param value registerType（寄存器类型）或 dataType（数据类型）。
 * @returns 小写且去空格的 token（标记）。
 */
function normalizeSignalToken(value: string): string {
  return value.trim().replace(/\s+/g, "").toLowerCase();
}

/**
 * @brief 将 unknown value（未知值）收窄成用户可见字符串，并避免复杂值抛错。
 * @author PopoY
 * @param value snapshot payload（快照载荷）中的 unknown（未知）运行时值。
 * @returns 适合 dashboard（仪表盘）渲染的字符串表示。
 */
function formatUnknownValue(value: unknown): string {
  if (value === null) {
    return "空值";
  }

  if (typeof value === "string") {
    return value || EMPTY_SIGNAL_CELL;
  }

  if (
    typeof value === "number" ||
    typeof value === "boolean" ||
    typeof value === "bigint"
  ) {
    return String(value);
  }

  if (value === undefined) {
    return "未定义";
  }

  try {
    const jsonValue = JSON.stringify(value);

    return jsonValue ?? String(value);
  } catch {
    return String(value);
  }
}
