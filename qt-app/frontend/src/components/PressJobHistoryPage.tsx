/**
 * @file PressJobHistoryPage.tsx - 渲染 Press Job History Page（压机历史作业页面）。
 * @author PopoY
 * @created 2026-07-24 19:52:32
 * @editor PopoY
 * @edited 2026-07-29 14:56:52
 * @brief 提供本地自然日筛选、服务端分页和脱敏历史作业详情。
 */

import { SearchOutlined } from "@ant-design/icons";
import {
  Alert,
  App as AntdApp,
  Button,
  Col,
  DatePicker,
  Descriptions,
  Drawer,
  Form,
  Pagination,
  Row,
  Select,
  Skeleton,
  Table,
  Tag,
  theme,
  Timeline,
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
  PressJobLookupData,
  PressJobTeamOptions,
  PressMoldCandidate,
} from "../domain/pressJob";
import { NumericKeypad } from "./NumericKeypad";
import {
  createPressMoldCandidateSearchInput,
  resolveActivePressJobTeamOptions,
  resolveNumericKeypadPosition,
} from "./PressJobPage";
import "./PressJobHistoryPage.css";

const { RangePicker } = DatePicker;
const EMPTY_HISTORY_TEXT = "当前查询范围暂无作业，请调整日期范围后查询。";
const OPERATION_PAGE_SIZE = 5;
let historyCorrelationSequence = 0;

export type HistoryDraftFilters = {
  dateRange: [Dayjs, Dayjs] | null;
  mouldCode: string;
  teamId?: string;
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
  pressJobLookupData?: PressJobLookupData;
  loadPressJobTeamOptions?: (teamId: string) => Promise<PressJobTeamOptions>;
  searchPressMoldCandidates?: (input: {
    moldNo: string;
    lockedMoldNos: string[];
    correlationId: string;
  }) => Promise<PressMoldCandidate[]>;
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
export function createInitialHistoryFilters(
  now: Dayjs,
  defaultTeamId?: string,
): HistoryDraftFilters & {
  dateRange: [Dayjs, Dayjs];
} {
  const today = now.startOf("day");
  return {
    dateRange: [today, today],
    mouldCode: "",
    operator: undefined,
    teamId: defaultTeamId,
  };
}

/**
 * @brief 切换班组时保留其他筛选并清空人员，防止提交旧班组人员。
 * @author PopoY
 */
export function createHistoryTeamChangeFilters(
  filters: HistoryDraftFilters,
  teamId?: string,
): HistoryDraftFilters {
  return { ...filters, operator: undefined, teamId };
}

/**
 * @brief 基于当前本地自然日生成历史查询 preset（快捷选项）。
 * @author PopoY
 * @param today 本地当天；默认值在每次页面渲染时重新计算。
 * @returns 最近 1/3/7/30 个自然日的闭区间。
 */
export function createHistoryRangePresets(
  today = dayjs().startOf("day"),
): Array<{ label: string; value: [Dayjs, Dayjs] }> {
  const localToday = today.startOf("day");
  return [1, 3, 7, 30].map((days) => ({
    label: `最近${
      days === 1 ? "一天" : days === 3 ? "三天" : days === 7 ? "一周" : "一月"
    }`,
    value: [localToday.subtract(days - 1, "day"), localToday],
  }));
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
    teamId?: string;
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
 * @brief 仅接收仍匹配当前版本和筛选值的班组或模具候选响应。
 * @author PopoY
 */
export function shouldApplyHistoryLookupResponse(
  requestedVersion: number,
  currentVersion: number,
  requestedValue: string | undefined,
  currentValue: string | undefined,
): boolean {
  return requestedVersion === currentVersion && requestedValue === currentValue;
}

/**
 * @brief 把 ERP 作业状态映射为固定中文，未知值不得回显。
 * @author PopoY
 */
export function formatHistoryStatus(status: string | undefined): string {
  if (status === "1") return "进行中";
  return status === "3" ? "已完成" : "状态未知";
}

/**
 * @brief 进行中作业没有完成时间，不得显示为普通缺失记录。
 * @author PopoY
 */
export function formatHistoryCompletedAt(
  status: string | undefined,
  completedAt: string | undefined,
): string {
  return status === "1" && !completedAt?.trim()
    ? "未完成"
    : formatHistoryCell(completedAt);
}

/**
 * @brief 进行中作业不在前端推算实时时长，只显示固定状态。
 * @author PopoY
 */
export function formatHistoryDuration(
  status: string | undefined,
  duration: string | undefined,
): string {
  return status === "1" && !duration?.trim()
    ? "进行中"
    : duration?.trim()
      ? `${duration} 小时`
      : "未记录";
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
export function createHistoryCorrelationId(
  scope: "list" | "detail" | "mold",
): string {
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
  pressJobLookupData,
  loadPressJobTeamOptions,
  searchPressMoldCandidates,
  loadHistoryList,
  loadHistoryDetail,
}: PressJobHistoryPageProps) {
  const { message: messageApi } = AntdApp.useApp();
  const {
    token: { colorPrimary, colorPrimaryBg, colorPrimaryBorder },
  } = theme.useToken();
  const drawerRootStyle = {
    "--qt-app-control-blue": colorPrimary,
    "--qt-app-control-blue-soft": colorPrimaryBg,
    "--qt-app-control-blue-line": colorPrimaryBorder,
  } as CSSProperties;
  const [draftFilters, setDraftFilters] = useState<HistoryDraftFilters>(() =>
    createInitialHistoryFilters(dayjs(), pressJobLookupData?.defaultTeamId),
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
  const [selectedTeamOptions, setSelectedTeamOptions] =
    useState<PressJobTeamOptions | null>(null);
  const [loadingTeamId, setLoadingTeamId] = useState<string | null>(null);
  const [mouldSearchText, setMouldSearchText] = useState("");
  const [mouldCandidates, setMouldCandidates] = useState<PressMoldCandidate[]>([]);
  const [mouldCandidateLoading, setMouldCandidateLoading] = useState(false);
  const [mouldSelectOpen, setMouldSelectOpen] = useState(false);
  const [mouldKeypadPosition, setMouldKeypadPosition] = useState<
    ReturnType<typeof resolveNumericKeypadPosition> | null
  >(null);
  const listRequestVersionRef = useRef(0);
  const detailRequestVersionRef = useRef(0);
  const teamLookupVersionRef = useRef(0);
  const mouldLookupVersionRef = useRef(0);
  const activeTeamIdRef = useRef(draftFilters.teamId);
  const mouldSearchTextRef = useRef(mouldSearchText);
  const activeMouldInputRef = useRef<HTMLElement | null>(null);
  const mouldKeypadOpenRef = useRef(false);
  const pendingSelectedMouldCodeRef = useRef<string | null>(null);
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
  activeTeamIdRef.current = draftFilters.teamId;
  mouldSearchTextRef.current = mouldSearchText;

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

  useEffect(() => {
    const defaultTeamId = pressJobLookupData?.defaultTeamId;
    if (!defaultTeamId) return;

    setDraftFilters((current) =>
      current.teamId ? current : { ...current, teamId: defaultTeamId },
    );
  }, [pressJobLookupData?.defaultTeamId]);

  const teamOptions = useMemo(
    () =>
      (pressJobLookupData?.teamOptions ?? []).map((team) => ({
        label: team.teamName,
        value: team.teamId,
      })),
    [pressJobLookupData?.teamOptions],
  );
  const activeTeamOptions = resolveActivePressJobTeamOptions(
    draftFilters.teamId,
    pressJobLookupData,
    selectedTeamOptions,
  );
  const activeOperatorOptions = activeTeamOptions.operatorOptions;
  const mouldCandidateOptions = useMemo(
    () =>
      mouldCandidates.map((candidate) => ({
        label: candidate.moldNo,
        value: candidate.moldNo,
      })),
    [mouldCandidates],
  );

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
        render: (value: string | undefined, row) =>
          formatHistoryCompletedAt(row.status, value),
      },
      {
        title: "实际时长",
        dataIndex: "actualDurationHours",
        width: 120,
        render: (value: string | undefined, row) =>
          formatHistoryDuration(row.status, value),
      },
      {
        title: "作业状态",
        dataIndex: "status",
        width: 110,
        render: (value: string | undefined) => (
          <Tag
            color={value === "1" ? "processing" : value === "3" ? "success" : "warning"}
          >
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

  /**
   * @brief 切换班组并加载该班组人员，迟到响应不得覆盖新班组。
   * @author PopoY
   */
  const handleTeamChange = (teamId?: string) => {
    const requestedVersion = ++teamLookupVersionRef.current;
    activeTeamIdRef.current = teamId;
    setSelectedTeamOptions(null);
    setLoadingTeamId(null);
    setDraftFilters((current) =>
      createHistoryTeamChangeFilters(current, teamId),
    );

    if (
      !teamId ||
      teamId === pressJobLookupData?.defaultTeamId ||
      !loadPressJobTeamOptions
    ) {
      return;
    }

    setLoadingTeamId(teamId);
    void loadPressJobTeamOptions(teamId)
      .then((nextOptions) => {
        if (
          shouldApplyHistoryLookupResponse(
            requestedVersion,
            teamLookupVersionRef.current,
            teamId,
            activeTeamIdRef.current,
          )
        ) {
          setSelectedTeamOptions(nextOptions);
        }
      })
      .catch(() => {
        if (
          shouldApplyHistoryLookupResponse(
            requestedVersion,
            teamLookupVersionRef.current,
            teamId,
            activeTeamIdRef.current,
          )
        ) {
          setSelectedTeamOptions({
            teamId,
            operatorOptions: [],
            processOptions: [],
          });
          messageApi.error("班组人员加载失败，请稍后重试。");
        }
      })
      .finally(() => {
        if (
          shouldApplyHistoryLookupResponse(
            requestedVersion,
            teamLookupVersionRef.current,
            teamId,
            activeTeamIdRef.current,
          )
        ) {
          setLoadingTeamId(null);
        }
      });
  };

  /**
   * @brief 更新模具搜索草稿；只有选择远程候选时才写入历史查询筛选。
   * @author PopoY
   */
  const handleMouldSearchTextChange = (nextText: string) => {
    const pendingSelectedMouldCode = pendingSelectedMouldCodeRef.current;
    if (!nextText && pendingSelectedMouldCode) {
      mouldSearchTextRef.current = pendingSelectedMouldCode;
      setMouldSearchText(pendingSelectedMouldCode);
      setMouldSelectOpen(false);
      return;
    }

    pendingSelectedMouldCodeRef.current = null;
    mouldLookupVersionRef.current += 1;
    mouldSearchTextRef.current = nextText;
    setMouldCandidateLoading(false);
    setMouldSearchText(nextText);
    setMouldCandidates([]);
    setMouldSelectOpen(false);
    setDraftFilters((current) => ({ ...current, mouldCode: "" }));
  };

  const handleMouldKeypadChange = (nextText: string) => {
    if (!nextText) pendingSelectedMouldCodeRef.current = null;
    handleMouldSearchTextChange(nextText);
  };

  const handleMouldCandidateChange = (mouldCode?: string) => {
    const candidate = mouldCandidates.find(
      (current) => current.moldNo === mouldCode,
    );
    if (!candidate) {
      pendingSelectedMouldCodeRef.current = null;
      handleMouldSearchTextChange("");
      return;
    }

    pendingSelectedMouldCodeRef.current = candidate.moldNo;
    mouldSearchTextRef.current = candidate.moldNo;
    setMouldSearchText(candidate.moldNo);
    setMouldSelectOpen(false);
    setDraftFilters((current) => ({
      ...current,
      mouldCode: candidate.moldNo,
    }));
  };

  /**
   * @brief 数字键盘确认后按现有模具锁定合同远程加载候选。
   * @author PopoY
   */
  const searchMouldCandidates = () => {
    const moldNo = mouldSearchText.trim();
    const requestedVersion = ++mouldLookupVersionRef.current;

    if (!searchPressMoldCandidates || !moldNo) {
      setMouldCandidates([]);
      setMouldCandidateLoading(false);
      setMouldSelectOpen(false);
      return;
    }

    const correlationId = createHistoryCorrelationId("mold");
    setMouldCandidateLoading(true);
    setMouldSelectOpen(true);
    void searchPressMoldCandidates(
      createPressMoldCandidateSearchInput(moldNo, [], correlationId),
    )
      .then((nextCandidates) => {
        if (
          shouldApplyHistoryLookupResponse(
            requestedVersion,
            mouldLookupVersionRef.current,
            moldNo,
            mouldSearchTextRef.current.trim(),
          )
        ) {
          setMouldCandidates(nextCandidates);
          setMouldSelectOpen(nextCandidates.length > 0);
        }
      })
      .catch(() => {
        if (
          shouldApplyHistoryLookupResponse(
            requestedVersion,
            mouldLookupVersionRef.current,
            moldNo,
            mouldSearchTextRef.current.trim(),
          )
        ) {
          setMouldCandidates([]);
          setMouldSelectOpen(false);
          messageApi.error("模具查询失败，请稍后重试。");
        }
      })
      .finally(() => {
        if (
          shouldApplyHistoryLookupResponse(
            requestedVersion,
            mouldLookupVersionRef.current,
            moldNo,
            mouldSearchTextRef.current.trim(),
          )
        ) {
          setMouldCandidateLoading(false);
        }
      });
  };

  const handleMouldKeypadFocus = (input: HTMLElement) => {
    activeMouldInputRef.current = input;
    mouldKeypadOpenRef.current = true;
    setMouldSelectOpen(false);
    setMouldKeypadPosition(
      resolveNumericKeypadPosition(
        input.getBoundingClientRect(),
        window.innerWidth,
        window.innerHeight,
      ),
    );
  };

  const closeMouldKeypad = (shouldBlur = true) => {
    mouldKeypadOpenRef.current = false;
    setMouldKeypadPosition(null);
    if (shouldBlur) {
      activeMouldInputRef.current?.blur();
      activeMouldInputRef.current = null;
    }
  };

  const handleMouldSelectOpenChange = (open: boolean) => {
    if (
      pendingSelectedMouldCodeRef.current ||
      mouldKeypadOpenRef.current ||
      mouldKeypadPosition
    ) {
      setMouldSelectOpen(false);
      return;
    }
    setMouldSelectOpen(open && mouldCandidates.length > 0);
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
      <Form
        aria-label="历史作业筛选区"
        className="press-job-history-page__filters"
        component="section"
        labelCol={{ flex: "72px" }}
        layout="horizontal"
        wrapperCol={{ flex: "1 1 0" }}
      >
        <Row className="press-job-history-page__filter-row" gutter={12} wrap={false}>
          <Col flex="0 0 360px">
            <Form.Item className="press-job-history-page__field" label="日期范围">
              <RangePicker
                allowClear={false}
                format="YYYY-MM-DD"
                presets={createHistoryRangePresets()}
                value={draftFilters.dateRange}
                onChange={handleDraftDateRangeChange}
              />
              {dateValidationMessage ? (
                <span className="press-job-history-page__validation">
                  {dateValidationMessage}
                </span>
              ) : null}
            </Form.Item>
          </Col>
          <Col flex="0 0 220px">
            <Form.Item className="press-job-history-page__field" label="模具号">
              <Select
                allowClear
                aria-label="模具号"
                classNames={{
                  popup: {
                    list: "press-job-page__select-list",
                    listItem: "press-job-page__select-option",
                    root: "press-job-page__select-popup press-job-page__mold-select-popup",
                  },
                }}
                listHeight={960}
                loading={mouldCandidateLoading}
                onBlur={() => closeMouldKeypad()}
                onChange={handleMouldCandidateChange}
                onFocus={(event) =>
                  handleMouldKeypadFocus(event.currentTarget)
                }
                onOpenChange={handleMouldSelectOpenChange}
                onSearch={handleMouldSearchTextChange}
                open={mouldSelectOpen}
                optionFilterProp="label"
                options={mouldCandidateOptions}
                placeholder="请输入模具号"
                popupMatchSelectWidth={false}
                searchValue={mouldSearchText}
                showSearch
                value={draftFilters.mouldCode || undefined}
                virtual={false}
              />
            </Form.Item>
          </Col>
          <Col flex="0 0 220px">
            <Form.Item className="press-job-history-page__field" label="班组">
              <Select
                allowClear
                aria-label="班组选择器"
                classNames={{
                  popup: {
                    list: "press-job-page__select-list",
                    listItem: "press-job-page__select-option",
                    root: "press-job-page__select-popup press-job-page__select-popup--two-column",
                  },
                }}
                listHeight={960}
                loading={loadingTeamId === draftFilters.teamId}
                onChange={handleTeamChange}
                optionFilterProp="label"
                options={teamOptions}
                placeholder="请选择班组"
                popupMatchSelectWidth={false}
                showSearch
                value={draftFilters.teamId}
                virtual={false}
              />
            </Form.Item>
          </Col>
          <Col flex="0 0 220px">
            <Form.Item className="press-job-history-page__field" label="人员">
              <Select
                allowClear
                aria-label="人员选择器"
                classNames={{
                  popup: {
                    list: "press-job-page__select-list",
                    listItem: "press-job-page__select-option",
                    root: "press-job-page__select-popup press-job-page__select-popup--two-column",
                  },
                }}
                disabled={!draftFilters.teamId || loadingTeamId === draftFilters.teamId}
                listHeight={960}
                loading={loadingTeamId === draftFilters.teamId}
                options={activeOperatorOptions.map((option) => ({
                  label: option.operatorName,
                  value: option.operatorId,
                }))}
                placeholder="全部人员"
                popupMatchSelectWidth={false}
                showSearch
                value={draftFilters.operator}
                onChange={(operator) =>
                  setDraftFilters((current) => ({ ...current, operator }))
                }
                virtual={false}
              />
            </Form.Item>
          </Col>
          <Col flex="auto">
            <Button
              className="press-job-history-page__query"
              disabled={dateValidationMessage !== null}
              icon={<SearchOutlined aria-hidden="true" />}
              onClick={handleQuery}
              type="primary"
            >
              查询
            </Button>
          </Col>
        </Row>
      </Form>

      {mouldKeypadPosition ? (
        <NumericKeypad
          onChange={handleMouldKeypadChange}
          onClose={closeMouldKeypad}
          onConfirm={() => {
            searchMouldCandidates();
            closeMouldKeypad(false);
          }}
          specialKey="-"
          style={mouldKeypadPosition}
          value={mouldSearchText}
        />
      ) : null}

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
        size="80%"
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
export function HistoryDetailContent({
  detail,
  operatorLabelByValue,
  craftLabelByValue,
}: {
  detail: PressJobHistoryDetail;
  operatorLabelByValue: Map<string, string>;
  craftLabelByValue: Map<string, string>;
}) {
  const [operationPage, setOperationPage] = useState(1);
  useEffect(() => {
    setOperationPage(1);
  }, [detail.moldJobId, detail.operationRecords]);
  const visibleOperations = detail.operationRecords.slice(
    (operationPage - 1) * OPERATION_PAGE_SIZE,
    operationPage * OPERATION_PAGE_SIZE,
  );
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
          { key: "status", label: "作业状态", children: formatHistoryStatus(detail.status) },
          {
            key: "duration",
            label: "实际时长",
            children: formatHistoryDuration(detail.status, detail.actualDurationHours),
          },
          { key: "operator", label: "班组 / 作业人员", children: `未记录 / ${operator}` },
          {
            key: "craft",
            label: "工艺",
            children: formatDictValue(craftLabelByValue, detail.craftCode),
          },
          { key: "start", label: "开始时间", children: formatHistoryCell(detail.startedAt) },
          {
            key: "end",
            label: "完成时间",
            children: formatHistoryCompletedAt(detail.status, detail.completedAt),
          },
        ]}
      />

      <div className="press-job-history-detail__body">
        <section className="press-job-history-detail__parameters" aria-label="参数记录">
          <Typography.Title level={5}>参数记录</Typography.Title>
          <div className="press-job-history-detail__parameter-states">
            {detail.startParameterState === "invalid" ? (
              <Typography.Text type="warning">开始参数记录格式异常</Typography.Text>
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
            <Timeline
              className="press-job-history-detail__operation-list"
              items={visibleOperations.map((operation, index) => ({
                key: `${operation.operationTime ?? "未记录"}-${index}`,
                content: (
                  <span className="press-job-history-detail__operation-item">
                    <time className="press-job-history-detail__operation-time">
                      {formatHistoryCell(operation.operationTime)}
                    </time>
                    <span className="press-job-history-detail__operation-content">
                      <span className="press-job-history-detail__operation-main">
                        <span className="press-job-history-detail__operation-name">
                          {formatHistoryCell(operation.operationName)}
                        </span>
                        <Tag
                          color={
                            operation.result === "成功"
                              ? "success"
                              : operation.result === "失败"
                                ? "error"
                                : "default"
                          }
                        >
                          {formatHistoryCell(operation.result)}
                        </Tag>
                      </span>
                      <span>
                        班组 / 作业人员：{formatHistoryCell(operation.teamName)} / {formatHistoryCell(
                          operation.operatorName,
                        )}
                      </span>
                    </span>
                  </span>
                ),
              }))}
            />
          )}
          {detail.operationRecords.length > OPERATION_PAGE_SIZE ? (
            <Pagination
              className="press-job-history-detail__operation-pagination"
              current={operationPage}
              onChange={setOperationPage}
              pageSize={OPERATION_PAGE_SIZE}
              showSizeChanger={false}
              size="small"
              total={detail.operationRecords.length}
            />
          ) : null}
        </section>
      </div>
    </div>
  );
}

/**
 * @brief 将参数值转换为固定安全文本。
 * @author PopoY
 */
export function formatHistoryParameterValue(
  parameter: PressJobHistoryParameter | undefined,
): string {
  if (parameter?.status !== "recorded" || parameter.value === undefined) {
    return "未记录";
  }
  if (parameter.valueKind === "state") {
    if (
      parameter.value === 0 ||
      parameter.value === "0" ||
      parameter.value === false
    ) {
      return "否";
    }
    if (
      parameter.value === 1 ||
      parameter.value === "1" ||
      parameter.value === true
    ) {
      return "是";
    }
  }
  return String(parameter.value);
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
