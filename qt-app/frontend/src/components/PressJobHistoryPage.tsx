/**
 * @file PressJobHistoryPage.tsx - 渲染 Press Job History Page（压机历史作业页面）。
 * @author PopoY
 * @created 2026-07-24 19:52:32
 * @editor PopoY
 * @edited 2026-07-24 20:33:14
 * @brief 提供本地自然日筛选、服务端分页和脱敏历史作业详情。
 */

import {
  Alert,
  Button,
  DatePicker,
  Descriptions,
  Drawer,
  Input,
  Select,
  Skeleton,
  Table,
  Tag,
  theme,
  Typography,
} from "antd";
import type { TableProps } from "antd";
import dayjs from "dayjs";
import type { Dayjs } from "dayjs";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";

import type { ErpDictOption } from "../domain/lease";
import type {
  PressJobHistoryDetail,
  PressJobHistoryPageResult,
  PressJobHistoryParameter,
  PressJobHistoryQuery,
  PressJobHistoryRow,
} from "../domain/pressJob";
import "./PressJobHistoryPage.css";

const { RangePicker } = DatePicker;
const EMPTY_HISTORY_TEXT = "当前查询范围暂无已完成作业，请调整日期范围后查询。";
let historyCorrelationSequence = 0;

export type HistoryDraftFilters = {
  dateRange: [Dayjs, Dayjs] | null;
  mouldCode: string;
  operator?: string;
};

export type HistoryParameterComparisonRow = {
  parameterName: string;
  startValue: string;
  endValue: string;
  unit: string;
  status: "已记录" | "记录不完整" | "参数异常";
};

export type PressJobHistoryPageProps = {
  operatorOptions: ErpDictOption[];
  craftOptions: ErpDictOption[];
  loadHistoryList: (
    query: PressJobHistoryQuery,
  ) => Promise<PressJobHistoryPageResult>;
  loadHistoryDetail: (input: {
    moldJobId: string;
    correlationId: string;
  }) => Promise<PressJobHistoryDetail>;
};

type RequestStatus = "idle" | "loading" | "success" | "error";
type HistoryListLoader = PressJobHistoryPageProps["loadHistoryList"];
type HistoryDetailLoader = PressJobHistoryPageProps["loadHistoryDetail"];
type HistoryListRequestIdentity = {
  query: PressJobHistoryQuery;
  loader: HistoryListLoader;
};

/**
 * @brief 创建工控机本地当天的不可清空默认筛选。
 * @author PopoY
 * @param now 工控机当前本地时间。
 * @returns 当天起止日期和空的可选筛选。
 */
export function createInitialHistoryFilters(now: Dayjs): HistoryDraftFilters & {
  dateRange: [Dayjs, Dayjs];
} {
  const today = now.startOf("day");
  return { dateRange: [today, today], mouldCode: "" };
}

/**
 * @brief 校验日期必填、正序且最多包含 31 个自然日。
 * @author PopoY
 * @param dateRange RangePicker（日期范围选择器）当前值。
 * @returns 通过时返回 null，否则返回固定中文提示。
 */
export function validateHistoryDateRange(
  dateRange: readonly [Dayjs, Dayjs] | null,
): string | null {
  if (!dateRange) return "请选择日期范围。";

  const [start, end] = dateRange;
  const naturalDayCount = end.startOf("day").diff(start.startOf("day"), "day") + 1;
  if (naturalDayCount < 1) return "结束日期不能早于开始日期。";
  return naturalDayCount > 31 ? "日期范围最多选择 31 个自然日。" : null;
}

/**
 * @brief 把已提交筛选转换为带本地 offset（偏移量）的半开查询区间。
 * @author PopoY
 * @param filters 待提交筛选快照。
 * @param pageNum 服务端页码。
 * @param correlationId 本次列表请求关联 ID。
 * @returns 固定每页十条的安全查询。
 */
export function buildHistoryQuery(
  filters: {
    dateRange: readonly [Dayjs, Dayjs] | null;
    mouldCode: string;
    operator?: string;
  },
  pageNum: number,
  correlationId: string,
): PressJobHistoryQuery {
  if (validateHistoryDateRange(filters.dateRange) || !filters.dateRange) {
    throw new Error("历史作业日期范围无效。");
  }

  const [start, end] = filters.dateRange;
  const mouldCode = filters.mouldCode.trim();
  const operator = filters.operator?.trim();

  return {
    startTime: start.startOf("day").format("YYYY-MM-DDTHH:mm:ssZ"),
    endTime: end.add(1, "day").startOf("day").format("YYYY-MM-DDTHH:mm:ssZ"),
    ...(mouldCode ? { mouldCode } : {}),
    ...(operator ? { operator } : {}),
    pageNum,
    pageSize: 10,
    correlationId,
  };
}

/**
 * @brief 仅当 query（查询）或 loader（加载器）身份改变时发起列表请求。
 * @author PopoY
 */
export function shouldRequestHistoryList(
  currentIdentity: HistoryListRequestIdentity | undefined,
  requestedQuery: PressJobHistoryQuery,
  requestedLoader: HistoryListLoader,
): boolean {
  return (
    currentIdentity?.query !== requestedQuery ||
    currentIdentity.loader !== requestedLoader
  );
}

/**
 * @brief 判断列表响应是否仍属于当前 request version（请求版本）、loader（加载器）和 query（查询）。
 * @author PopoY
 */
export function shouldApplyHistoryListResponse(
  requestedVersion: number,
  currentVersion: number,
  requestedLoader: HistoryListLoader,
  currentLoader: HistoryListLoader,
  requestedQuery: PressJobHistoryQuery,
  currentQuery: PressJobHistoryQuery,
): boolean {
  return (
    requestedVersion === currentVersion &&
    requestedLoader === currentLoader &&
    requestedQuery === currentQuery
  );
}

/**
 * @brief 判断详情响应是否仍属于当前版本、作业和 loader（加载器）。
 * @author PopoY
 */
export function shouldApplyHistoryDetailResponse(
  requestedVersion: number,
  currentVersion: number,
  requestedMoldJobId: string,
  selectedMoldJobId: string | undefined,
  requestedLoader: HistoryDetailLoader,
  currentLoader: HistoryDetailLoader,
): boolean {
  return (
    requestedVersion === currentVersion &&
    requestedMoldJobId === selectedMoldJobId &&
    requestedLoader === currentLoader
  );
}

/**
 * @brief 把 ERP 完工状态映射为固定中文，未知值不得回显。
 * @author PopoY
 */
export function formatHistoryStatus(status: string | undefined): string {
  return status === "3" ? "已完成" : "状态未知";
}

/**
 * @brief 按参数名称对齐开始与完工记录，并保留单侧有效记录。
 * @author PopoY
 */
export function alignHistoryParameters(
  startParameters: PressJobHistoryParameter[],
  endParameters: PressJobHistoryParameter[],
): HistoryParameterComparisonRow[] {
  const startByName = new Map(
    startParameters.map((parameter) => [parameter.parameterName, parameter]),
  );
  const endByName = new Map(
    endParameters.map((parameter) => [parameter.parameterName, parameter]),
  );
  const parameterNames = [
    ...startByName.keys(),
    ...[...endByName.keys()].filter((name) => !startByName.has(name)),
  ];

  return parameterNames.map((parameterName) => {
    const start = startByName.get(parameterName);
    const end = endByName.get(parameterName);
    const invalid = start?.status === "invalid" || end?.status === "invalid";

    return {
      parameterName,
      startValue: formatHistoryParameterValue(start),
      endValue: formatHistoryParameterValue(end),
      unit: start?.unit?.trim() || end?.unit?.trim() || "未记录",
      status: invalid
        ? "参数异常"
        : start?.status === "recorded" && end?.status === "recorded"
          ? "已记录"
          : "记录不完整",
    };
  });
}

/**
 * @brief 生成本地单调 request correlation ID（请求关联 ID）。
 * @author PopoY
 */
export function createHistoryCorrelationId(scope: "list" | "detail"): string {
  historyCorrelationSequence += 1;
  return `qt-history-${scope}-${Date.now()}-${historyCorrelationSequence}`;
}

/**
 * @brief 渲染只接收脱敏 options（选项）和只读回调的历史作业页面。
 * @author PopoY
 */
export function PressJobHistoryPage({
  operatorOptions,
  craftOptions,
  loadHistoryList,
  loadHistoryDetail,
}: PressJobHistoryPageProps) {
  const {
    token: { colorPrimary, colorPrimaryBg, colorPrimaryBorder },
  } = theme.useToken();
  const drawerRootStyle = {
    "--qt-app-control-blue": colorPrimary,
    "--qt-app-control-blue-soft": colorPrimaryBg,
    "--qt-app-control-blue-line": colorPrimaryBorder,
  } as CSSProperties;
  const [draftFilters, setDraftFilters] = useState<HistoryDraftFilters>(() =>
    createInitialHistoryFilters(dayjs()),
  );
  const [appliedQuery, setAppliedQuery] = useState(() =>
    buildHistoryQuery(
      createInitialHistoryFilters(dayjs()),
      1,
      createHistoryCorrelationId("list"),
    ),
  );
  const [listResult, setListResult] = useState<PressJobHistoryPageResult>({
    rows: [],
    total: 0,
    pageNum: 1,
    pageSize: 10,
  });
  const [listStatus, setListStatus] = useState<RequestStatus>("idle");
  const [listLoading, setListLoading] = useState(true);
  const [selectedMoldJobId, setSelectedMoldJobId] = useState<string>();
  const [detail, setDetail] = useState<PressJobHistoryDetail>();
  const [detailStatus, setDetailStatus] = useState<RequestStatus>("idle");
  const [detailLoading, setDetailLoading] = useState(false);
  const listRequestVersionRef = useRef(0);
  const detailRequestVersionRef = useRef(0);
  const selectedMoldJobIdRef = useRef<string | undefined>(undefined);
  const triggerRowRef = useRef<HTMLElement | null>(null);
  const currentLoadHistoryListRef = useRef(loadHistoryList);
  const currentLoadHistoryDetailRef = useRef(loadHistoryDetail);
  const currentAppliedQueryRef = useRef(appliedQuery);
  const lastRequestedListIdentityRef =
    useRef<HistoryListRequestIdentity | undefined>(undefined);
  currentLoadHistoryListRef.current = loadHistoryList;
  currentLoadHistoryDetailRef.current = loadHistoryDetail;
  currentAppliedQueryRef.current = appliedQuery;

  const runHistoryListRequest = useCallback(
    (query: PressJobHistoryQuery) => {
      const requestedVersion = ++listRequestVersionRef.current;
      const requestedLoader = loadHistoryList;
      setListLoading(true);

      requestedLoader(query)
        .then((result) => {
          if (
            !shouldApplyHistoryListResponse(
              requestedVersion,
              listRequestVersionRef.current,
              requestedLoader,
              currentLoadHistoryListRef.current,
              query,
              currentAppliedQueryRef.current,
            )
          ) {
            return;
          }
          setListResult(result);
          setListStatus("success");
        })
        .catch(() => {
          if (
            !shouldApplyHistoryListResponse(
              requestedVersion,
              listRequestVersionRef.current,
              requestedLoader,
              currentLoadHistoryListRef.current,
              query,
              currentAppliedQueryRef.current,
            )
          ) {
            return;
          }
          setListStatus("error");
        })
        .finally(() => {
          if (
            !shouldApplyHistoryListResponse(
              requestedVersion,
              listRequestVersionRef.current,
              requestedLoader,
              currentLoadHistoryListRef.current,
              query,
              currentAppliedQueryRef.current,
            )
          ) {
            return;
          }
          setListLoading(false);
        });
    },
    [loadHistoryList],
  );

  useEffect(() => {
    // @author PopoY: query（查询）与 loader（加载器）共同去重，loader 换代必须重取当前快照。
    if (
      !shouldRequestHistoryList(
        lastRequestedListIdentityRef.current,
        appliedQuery,
        loadHistoryList,
      )
    ) {
      return;
    }
    lastRequestedListIdentityRef.current = {
      query: appliedQuery,
      loader: loadHistoryList,
    };
    runHistoryListRequest(appliedQuery);
  }, [appliedQuery, loadHistoryList, runHistoryListRequest]);

  const runHistoryDetailRequest = useCallback(
    (moldJobId: string) => {
      const requestedVersion = ++detailRequestVersionRef.current;
      const requestedLoader = loadHistoryDetail;
      setDetail(undefined);
      setDetailLoading(true);
      setDetailStatus("loading");

      requestedLoader({
        moldJobId,
        correlationId: createHistoryCorrelationId("detail"),
      })
        .then((result) => {
          if (
            !shouldApplyHistoryDetailResponse(
              requestedVersion,
              detailRequestVersionRef.current,
              moldJobId,
              selectedMoldJobIdRef.current,
              requestedLoader,
              currentLoadHistoryDetailRef.current,
            )
          ) {
            return;
          }
          setDetail(result);
          setDetailStatus("success");
        })
        .catch(() => {
          if (
            !shouldApplyHistoryDetailResponse(
              requestedVersion,
              detailRequestVersionRef.current,
              moldJobId,
              selectedMoldJobIdRef.current,
              requestedLoader,
              currentLoadHistoryDetailRef.current,
            )
          ) {
            return;
          }
          setDetailStatus("error");
        })
        .finally(() => {
          if (
            !shouldApplyHistoryDetailResponse(
              requestedVersion,
              detailRequestVersionRef.current,
              moldJobId,
              selectedMoldJobIdRef.current,
              requestedLoader,
              currentLoadHistoryDetailRef.current,
            )
          ) {
            return;
          }
          setDetailLoading(false);
        });
    },
    [loadHistoryDetail],
  );

  useEffect(() => {
    detailRequestVersionRef.current += 1;
    setDetail(undefined);
    setDetailStatus("idle");
    setDetailLoading(false);
    const moldJobId = selectedMoldJobIdRef.current;
    if (moldJobId) runHistoryDetailRequest(moldJobId);
  }, [loadHistoryDetail, runHistoryDetailRequest]);

  const operatorLabelByValue = useMemo(
    () => new Map(operatorOptions.map((option) => [option.dictValue, option.dictLabel])),
    [operatorOptions],
  );
  const craftLabelByValue = useMemo(
    () => new Map(craftOptions.map((option) => [option.dictValue, option.dictLabel])),
    [craftOptions],
  );
  const selectedRow = useMemo(
    () => listResult.rows.find((row) => row.moldJobId === selectedMoldJobId),
    [listResult.rows, selectedMoldJobId],
  );

  const columns = useMemo<TableProps<PressJobHistoryRow>["columns"]>(
    () => [
      {
        title: "压机",
        dataIndex: "pressName",
        width: 110,
        ellipsis: true,
        render: (value: string | undefined) => formatHistoryCell(value),
      },
      {
        title: "模具号",
        dataIndex: "moldNo",
        width: 140,
        ellipsis: true,
        render: (value: string) => formatHistoryCell(value),
      },
      {
        title: "作业人员",
        dataIndex: "operatorId",
        width: 100,
        ellipsis: true,
        render: (value: string | undefined) =>
          formatDictValue(operatorLabelByValue, value),
      },
      {
        title: "工艺",
        dataIndex: "craftCode",
        width: 130,
        ellipsis: true,
        render: (value: string | undefined) =>
          formatDictValue(craftLabelByValue, value),
      },
      {
        title: "开始时间",
        dataIndex: "startedAt",
        width: 180,
        render: (value: string | undefined) => formatHistoryCell(value),
      },
      {
        title: "完成时间",
        dataIndex: "completedAt",
        width: 180,
        render: (value: string | undefined) => formatHistoryCell(value),
      },
      {
        title: "实际时长",
        dataIndex: "actualDurationHours",
        width: 120,
        render: (value: string | undefined) =>
          value?.trim() ? `${value} 小时` : "未记录",
      },
      {
        title: "完工状态",
        dataIndex: "status",
        width: 110,
        render: (value: string | undefined) => (
          <Tag color={value === "3" ? "success" : "warning"}>
            {formatHistoryStatus(value)}
          </Tag>
        ),
      },
    ],
    [craftLabelByValue, operatorLabelByValue],
  );

  const handleDraftDateRangeChange = (
    value: [Dayjs | null, Dayjs | null] | null,
  ) => {
    setDraftFilters((current) => ({
      ...current,
      dateRange: value?.[0] && value[1] ? [value[0], value[1]] : null,
    }));
  };

  const dateValidationMessage = validateHistoryDateRange(draftFilters.dateRange);

  const handleQuery = () => {
    if (dateValidationMessage) return;
    setAppliedQuery(
      buildHistoryQuery(
        draftFilters,
        1,
        createHistoryCorrelationId("list"),
      ),
    );
  };

  const handlePageChange = (pageNum: number) => {
    setAppliedQuery((current) => ({
      ...current,
      pageNum,
      correlationId: createHistoryCorrelationId("list"),
    }));
  };

  const handleRetryList = () => {
    setAppliedQuery((current) => ({
      ...current,
      correlationId: createHistoryCorrelationId("list"),
    }));
  };

  const handleOpenDetail = (row: PressJobHistoryRow, trigger: HTMLElement) => {
    if (selectedMoldJobIdRef.current !== undefined) return;
    triggerRowRef.current = trigger;
    selectedMoldJobIdRef.current = row.moldJobId;
    setSelectedMoldJobId(row.moldJobId);
    runHistoryDetailRequest(row.moldJobId);
  };

  const handleCloseDetail = () => {
    detailRequestVersionRef.current += 1;
    selectedMoldJobIdRef.current = undefined;
    setSelectedMoldJobId(undefined);
    setDetail(undefined);
    setDetailStatus("idle");
    setDetailLoading(false);
  };

  const handleDetailOpenChange = (open: boolean) => {
    if (!open) triggerRowRef.current?.focus();
  };

  const handleRetryDetail = () => {
    if (selectedMoldJobIdRef.current) {
      runHistoryDetailRequest(selectedMoldJobIdRef.current);
    }
  };

  const listEmptyContent = listLoading ? (
    <Skeleton active paragraph={{ rows: 5 }} title={false} />
  ) : listStatus === "error" ? (
    <Alert
      action={<Button onClick={handleRetryList}>重试</Button>}
      message="历史作业加载失败，请重试。"
      showIcon
      type="error"
    />
  ) : (
    EMPTY_HISTORY_TEXT
  );

  return (
    <section className="press-job-history-page" aria-label="历史作业">
      <div className="press-job-history-page__filters">
        <label className="press-job-history-page__field">
          <span>日期范围</span>
          <RangePicker
            allowClear={false}
            format="YYYY-MM-DD"
            value={draftFilters.dateRange}
            onChange={handleDraftDateRangeChange}
          />
          {dateValidationMessage ? (
            <span className="press-job-history-page__validation">
              {dateValidationMessage}
            </span>
          ) : null}
        </label>
        <label className="press-job-history-page__field">
          <span>模具号</span>
          <Input
            aria-label="模具号"
            placeholder="请输入模具号"
            value={draftFilters.mouldCode}
            onChange={(event) =>
              setDraftFilters((current) => ({
                ...current,
                mouldCode: event.target.value,
              }))
            }
          />
        </label>
        <label className="press-job-history-page__field">
          <span>作业人员</span>
          <Select
            allowClear
            aria-label="作业人员"
            options={operatorOptions.map((option) => ({
              label: option.dictLabel,
              value: option.dictValue,
            }))}
            placeholder="全部人员"
            value={draftFilters.operator}
            onChange={(operator) =>
              setDraftFilters((current) => ({ ...current, operator }))
            }
          />
        </label>
        <Button
          className="press-job-history-page__query"
          disabled={dateValidationMessage !== null}
          onClick={handleQuery}
          type="primary"
        >
          查询
        </Button>
      </div>

      <Table<PressJobHistoryRow>
        className="press-job-history-page__table"
        columns={columns}
        dataSource={listLoading || listStatus === "error" ? [] : listResult.rows}
        locale={{ emptyText: listEmptyContent }}
        onRow={(row) => ({
          "aria-label": `查看作业 ${row.moldNo}`,
          onClick: (event) => handleOpenDetail(row, event.currentTarget),
          onKeyDown: (event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              handleOpenDetail(row, event.currentTarget);
            }
          },
          role: "button",
          tabIndex: 0,
        })}
        pagination={{
          current: appliedQuery.pageNum,
          pageSize: 10,
          total: listResult.total,
          showSizeChanger: false,
          showTotal: (total) => `共 ${total} 条`,
          onChange: handlePageChange,
        }}
        rowClassName={(row) =>
          row.moldJobId === selectedMoldJobId
            ? "press-job-history-page__row--selected"
            : ""
        }
        rowKey="moldJobId"
        scroll={{ x: 1070, y: "100%" }}
        size="small"
      />

      <Drawer
        afterOpenChange={handleDetailOpenChange}
        className="press-job-history-detail"
        destroyOnHidden={false}
        onClose={handleCloseDetail}
        open={selectedMoldJobId !== undefined}
        rootStyle={drawerRootStyle}
        size="70%"
        title={`作业详情 · ${selectedRow?.moldNo ?? "未记录"}`}
      >
        {detailLoading || detailStatus === "loading" ? (
          <Skeleton active paragraph={{ rows: 10 }} />
        ) : detailStatus === "error" ? (
          <Alert
            action={<Button onClick={handleRetryDetail}>重试</Button>}
            message="作业详情加载失败，请重试。"
            showIcon
            type="error"
          />
        ) : detail ? (
          <HistoryDetailContent
            craftLabelByValue={craftLabelByValue}
            detail={detail}
            operatorLabelByValue={operatorLabelByValue}
          />
        ) : null}
      </Drawer>
    </section>
  );
}

/**
 * @brief 渲染历史详情概要、参数对照和操作记录。
 * @author PopoY
 */
function HistoryDetailContent({
  detail,
  operatorLabelByValue,
  craftLabelByValue,
}: {
  detail: PressJobHistoryDetail;
  operatorLabelByValue: Map<string, string>;
  craftLabelByValue: Map<string, string>;
}) {
  const parameterRows = alignHistoryParameters(
    detail.startParameters,
    detail.endParameters,
  );
  const parameterColumns: TableProps<HistoryParameterComparisonRow>["columns"] = [
    { title: "参数名称", dataIndex: "parameterName", width: "28%" },
    { title: "开始参数", dataIndex: "startValue", width: "18%" },
    { title: "完工参数", dataIndex: "endValue", width: "18%" },
    { title: "单位", dataIndex: "unit", width: "14%" },
    {
      title: "状态",
      dataIndex: "status",
      width: "22%",
      render: (status: HistoryParameterComparisonRow["status"]) => (
        <Tag color={status === "已记录" ? "success" : "warning"}>{status}</Tag>
      ),
    },
  ];
  const operator = formatDictValue(
    operatorLabelByValue,
    detail.operatorId,
  );

  return (
    <div className="press-job-history-detail__layout">
      <Descriptions
        className="press-job-history-detail__summary"
        column={4}
        items={[
          { key: "press", label: "压机", children: formatHistoryCell(detail.pressName) },
          { key: "mold", label: "模具号", children: detail.moldNo },
          { key: "status", label: "完工状态", children: formatHistoryStatus(detail.status) },
          {
            key: "duration",
            label: "实际时长",
            children: detail.actualDurationHours
              ? `${detail.actualDurationHours} 小时`
              : "未记录",
          },
          { key: "operator", label: "班组 / 作业人员", children: `未记录 / ${operator}` },
          {
            key: "craft",
            label: "工艺",
            children: formatDictValue(craftLabelByValue, detail.craftCode),
          },
          { key: "start", label: "开始时间", children: formatHistoryCell(detail.startedAt) },
          { key: "end", label: "完成时间", children: formatHistoryCell(detail.completedAt) },
        ]}
      />

      <div className="press-job-history-detail__body">
        <section className="press-job-history-detail__parameters" aria-label="参数记录">
          <Typography.Title level={5}>参数记录</Typography.Title>
          <div className="press-job-history-detail__parameter-states">
            {detail.startParameterState === "missing" ? (
              <Typography.Text type="secondary">未记录开始参数</Typography.Text>
            ) : null}
            {detail.startParameterState === "invalid" ? (
              <Typography.Text type="warning">开始参数记录格式异常</Typography.Text>
            ) : null}
            {detail.endParameterState === "missing" ? (
              <Typography.Text type="secondary">未记录完工参数</Typography.Text>
            ) : null}
            {detail.endParameterState === "invalid" ? (
              <Typography.Text type="warning">完工参数记录格式异常</Typography.Text>
            ) : null}
          </div>
          <Table<HistoryParameterComparisonRow>
            columns={parameterColumns}
            dataSource={parameterRows}
            locale={{ emptyText: "暂无可对照参数" }}
            pagination={false}
            rowKey="parameterName"
            scroll={{ y: "100%" }}
            size="small"
          />
        </section>

        <section className="press-job-history-detail__operations" aria-label="操作记录">
          <Typography.Title level={5}>操作记录</Typography.Title>
          {detail.operationRecords.length === 0 ? (
            <Typography.Text type="secondary">
              该作业没有可查看的操作记录
            </Typography.Text>
          ) : (
            <ol className="press-job-history-detail__operation-list">
              {detail.operationRecords.map((operation, index) => (
                <li key={`${operation.operationTime ?? "未记录"}-${index}`}>
                  <time>{formatHistoryCell(operation.operationTime)}</time>
                  <span>{operation.operationName}</span>
                  <Tag color="success">成功</Tag>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>
    </div>
  );
}

/**
 * @brief 将参数值转换为固定安全文本。
 * @author PopoY
 */
function formatHistoryParameterValue(
  parameter: PressJobHistoryParameter | undefined,
): string {
  return parameter?.status === "recorded" && parameter.value !== undefined
    ? String(parameter.value)
    : "未记录";
}

/**
 * @brief 显示字典 label（标签），未命中时保留安全 code 或显示未记录。
 * @author PopoY
 */
function formatDictValue(
  labels: Map<string, string>,
  value: string | undefined,
): string {
  const normalized = value?.trim();
  return normalized ? labels.get(normalized) ?? normalized : "未记录";
}

/**
 * @brief 把可选展示值转换为非空中文占位文本。
 * @author PopoY
 */
function formatHistoryCell(value: string | undefined): string {
  return value?.trim() || "未记录";
}
