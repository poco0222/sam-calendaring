/**
 * @file PressJobPage.test.tsx - 验证 Press Working Page（压机作业页面）。
 * @author PopoY
 * @created 2026-06-30
 * @brief 锁定 frontend-only（仅前端）压机作业页的四行布局、空数据和安全边界。
 */

// @ts-ignore @author PopoY: 当前项目未安装 Node types（Node 类型），此测试运行时由 Vitest（测试框架）提供 node:fs。
import { existsSync, readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { AntdRootProvider } from "../app/AntdRootProvider";
import { fetchPressJobCurrentJobs } from "../services/erpClient";
import {
  applyPlannedDurationSaveCompletion,
  armPersistedPlannedDurationDraftMarkers,
  commitPlannedDurationInput,
  consumeArmedPersistedPlannedDurationDraftMarkers,
  createPressDeviceActionIdentity,
  createPressMoldCandidateSearchInput,
  createPressMoldInfoSearchInput,
  buildPressJobCompleteRequest,
  buildPressJobParameterRequest,
  buildPressJobStartRequest,
  createPressMoldLockDiagnosticSummary,
  createPressMoldLockRequest,
  createPressMoldLockSelection,
  createPressMoldUnlockDiagnosticSummary,
  createPressMoldUnlockRequest,
  discardPlannedDurationDraft,
  dropPersistedPlannedDurationDrafts,
  executePressJobLineOutWorkflow,
  executePressJobMoveOutWorkflow,
  executePressJobStartWorkflow,
  executePressJobSimpleDeviceAction,
  formatPressLockedMoldCraftName,
  formatPressLockedMoldOperatorName,
  formatPressLockedMoldWorkType,
  isCurrentJobStateKnown,
  readPrimaryCurrentJob,
  resolveMoldInfoRowProcessId,
  resolvePlannedDurationDraftKey,
  createPressJobTeamChangeState,
  normalizePlannedDurationInput,
  PressJobPage,
  resolvePressJobDefaultFilterState,
  shouldLoadPersistedPressJobTeamOptions,
  resolvePressMoldLockErrorMessage,
  resolvePressMoldUnlockErrorMessage,
  resolveNumericKeypadPosition,
  resolveActivePressJobTeamOptions,
  runCompletePressJobWorkflow,
  savePressJobExpectedDuration,
  submitPressMoldLockWithRefresh,
  submitPressMoldUnlockWithRefresh,
  validateCompletePressJobPreflight,
  validateCompletePressJobTourStep,
  validateLockMoldTourStep,
  validateMoldLockPreflight,
  validatePressMoldLockSelection,
  validatePressMoldUnlockSelection,
  validateStartPressJobPreflight,
  validateStartPressJobTourStep,
  validateSharedPressDeviceActionPreflight,
  validateUnlockMoldTourStep,
} from "./PressJobPage";

const pageCssUrl = new URL("./PressJobPage.css", import.meta.url);
const pageCss = existsSync(pageCssUrl) ? readFileSync(pageCssUrl, "utf8") : "";
const pageSourceUrl = new URL("./PressJobPage.tsx", import.meta.url);
const pageSource = existsSync(pageSourceUrl)
  ? readFileSync(pageSourceUrl, "utf8")
  : "";

/**
 * @brief 渲染 PressJobPage（压机作业页）为 static HTML（静态 HTML）。
 * @author PopoY
 * @param page 被测试的 React element（React 元素）。
 * @returns server-rendered HTML（服务端渲染 HTML）。
 */
function renderPage(page = <PressJobPage />): string {
  return renderToStaticMarkup(
    <AntdRootProvider>
      {page}
    </AntdRootProvider>,
  );
}

/**
 * @brief 创建 deferred Promise（延迟 Promise），用于精确控制预计时长保存完成顺序。
 * @author PopoY
 * @returns 可由测试主动完成或拒绝的 Promise（承诺）。
 */
function createDeferred<T>() {
  let reject!: (reason?: unknown) => void;
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });

  return { promise, reject, resolve };
}

/**
 * @brief 按指定 signalValues（信号值）渲染压机出入线状态，固定 ERP status（状态）以隔离实时信号语义。
 * @author PopoY
 * @param signalValues Driver snapshot（驱动快照）中的信号值。
 * @returns server-rendered HTML（服务端渲染 HTML）。
 */
function renderPressJobLineStatus(
  signalValues: Record<string, unknown>,
): string {
  return renderPage(
    <PressJobPage
      currentJobRows={[
        {
          localJobSessionId: "job-line-status",
          plannedDurationHours: "2",
          pressName: "压机 1",
          status: "1",
        },
      ]}
      driverSession={{
        data: {
          applyResult: null,
          signalSnapshot: {
            correlationId: "cid-line-status",
            resultCode: "OK",
            signalValues,
          },
        },
        error: null,
        status: "success",
      }}
    />,
  );
}

/**
 * @brief 截取指定 aria-label（可访问标签）的 section（区块）HTML，用于校验按钮归属。
 * @author PopoY
 * @param html 服务端渲染出的完整 HTML。
 * @param ariaLabel 目标区块的 aria-label（可访问标签）。
 * @returns 匹配到的 section（区块）HTML，未匹配时返回空字符串。
 */
function extractAriaSectionHtml(html: string, ariaLabel: string): string {
  return (
    html.match(
      new RegExp(`<section[^>]*aria-label="${ariaLabel}"[\\s\\S]*?</section>`),
    )?.[0] ?? ""
  );
}

/**
 * @brief 截取源码片段，避免 UI contract（界面契约）测试误扫相邻区域。
 * @author PopoY
 * @param source 完整源码文本。
 * @param startMarker 起始标记。
 * @param endMarker 结束标记。
 * @returns 两个标记之间的源码片段。
 */
function extractSourceBetween(
  source: string,
  startMarker: string,
  endMarker: string,
): string {
  const startIndex = source.indexOf(startMarker);
  const endIndex = source.indexOf(endMarker, startIndex + startMarker.length);

  return startIndex >= 0 && endIndex > startIndex
    ? source.slice(startIndex, endIndex)
    : "";
}

describe("PressJobPage", () => {
  /**
   * @brief 断言 Tour guidance（漫游式指导）使用 Ant Design Tour（组件库漫游）和本地受控状态。
   * @author PopoY
   */
  it("defines controlled tour state and target refs", () => {
    expect(pageSource).toContain("Tour,");
    expect(pageSource).toContain("TourStepProps");
    expect(pageSource).toContain('type PressJobTourKey = "start" | "complete" | "unlock" | "lock"');
    expect(pageSource).toContain("const [activeTour, setActiveTour] = useState<PressJobTourKey | null>(null)");
    expect(pageSource).toContain("const [currentTourStep, setCurrentTourStep] = useState(0)");
    expect(pageSource).toContain("closePressJobTour");
    expect(pageSource).toContain("openPressJobTour");
    expect(pageSource).toContain("advancePressJobTour");
    expect(pageSource).toContain("teamTourTargetRef");
    expect(pageSource).toContain("unlockConfirmButtonTourTargetRef");
    expect(pageSource).toContain("<Tour");
    expect(pageSource).not.toContain("usePressJobTourStore");
    expect(pageSource).not.toContain("createTourOverlay");
  });

  /**
   * @brief 断言 Tour（漫游式引导）Finish（完成）按钮也执行当前步骤 guard（条件检查）。
   * @author PopoY
   */
  it("guards the current tour step before finish closes the tour", () => {
    const finishTourSource = extractSourceBetween(
      pageSource,
      "const finishPressJobTour =",
      "const updatePressJobFilters =",
    );
    const tourSource = extractSourceBetween(pageSource, "<Tour", "/>");

    expect(finishTourSource).toContain("activeTourSteps[currentTourStep]?.guard?.()");
    expect(finishTourSource).toContain("messageApi.warning(warningMessage)");
    expect(
      finishTourSource.slice(
        finishTourSource.indexOf("if (warningMessage) {"),
        finishTourSource.indexOf("closePressJobTour();"),
      ),
    ).toContain("return;");
    expect(finishTourSource).toContain("closePressJobTour();");
    expect(tourSource).toContain("onFinish={finishPressJobTour}");
    expect(tourSource).not.toContain("onFinish={closePressJobTour}");
  });

  /**
   * @brief 断言 Tour guidance（漫游式指导）不新增敏感日志和生产自动提交路径。
   * @author PopoY
   */
  it("keeps tour guidance separate from production submits and sensitive data", () => {
    // @author PopoY: 仅扫描 Tour guidance（漫游式指导）相关源码，避免命中既有 sanitizer（脱敏器）禁止词列表。
    const tourGuidanceSource = [
      extractSourceBetween(pageSource, "const startTourSteps =", "const activeTourSteps ="),
      extractSourceBetween(pageSource, "const openPressJobTour =", "const advancePressJobTour ="),
      extractSourceBetween(pageSource, 'className="press-job-page__guidance-launchers"', "</Form>"),
      extractSourceBetween(
        pageSource,
        'className="press-job-page__mold-unlock-drawer"',
        "</Drawer>",
      ),
    ].join("\n");

    expect(pageSource).toContain('openPressJobTour("start")');
    expect(pageSource).toContain('openPressJobTour("complete")');
    expect(pageSource).toContain('openPressJobTour("unlock")');
    expect(tourGuidanceSource).not.toContain("guidanceSelectedRows");
    expect(tourGuidanceSource).not.toContain("console.log");
    expect(tourGuidanceSource).not.toContain("logTour");
    expect(tourGuidanceSource).not.toContain("sessionToken");
    expect(tourGuidanceSource).not.toContain("signedLease");
    expect(tourGuidanceSource).not.toContain("signature");
    expect(tourGuidanceSource).not.toContain("privateKey");
    expect(tourGuidanceSource).not.toContain("credential");
    expect(tourGuidanceSource).not.toContain("signalConfig");
    expect(tourGuidanceSource).not.toContain("selectedRows");
    expect(tourGuidanceSource).not.toContain("deviceId");
    expect(tourGuidanceSource).not.toContain('"ip"');
    expect(tourGuidanceSource).not.toContain("ip:");
    expect(tourGuidanceSource).not.toContain('"port"');
    expect(tourGuidanceSource).not.toContain("port:");
  });

  /**
   * @brief 断言顶部筛选区新增 guidance launcher（指导启动入口）且不使用 Form inline（内联表单）。
   * @author PopoY
   */
  it("renders top guidance launchers beside compact filters", () => {
    const html = renderPage();

    expect(html).toContain("开始加工指导");
    expect(html).toContain("完成加工指导");
    expect(html).toContain("press-job-page__guidance-launchers");
    expect(pageSource).toContain('onClick={() => openPressJobTour("start")}');
    expect(pageSource).toContain('onClick={() => openPressJobTour("complete")}');
    expect(pageSource).toContain('flex="0 0 220px"');
    expect(pageSource).toContain('flex="0 0 360px"');
    expect(pageSource).not.toContain("inline");
  });

  /**
   * @brief 断言顶部 guidance launcher（指导启动入口）在 1280x720 下右对齐且保持 touch target（触控目标）。
   * @author PopoY
   */
  it("keeps top guidance launchers right aligned and touch ready", () => {
    expect(pageCss).toContain(".press-job-page__filter-row");
    expect(pageCss).toContain("flex-wrap: nowrap");
    expect(pageCss).toContain(".press-job-page__guidance-launchers");
    expect(pageCss).toContain("justify-content: flex-end");
    expect(pageCss).toContain(".press-job-page__guidance-launchers .ant-btn");
    expect(pageCss).toContain("min-height: 44px");
  });

  /**
   * @brief 断言开始加工 guidance（指导）按班组、人员、工艺、锁模、预计时长顺序阻止推进。
   * @author PopoY
   */
  it("guards start processing tour steps", () => {
    const filters = { teamId: "team-01", operatorId: "op-01", processId: "PRESS-01" };
    const pendingJob = {
      localJobSessionId: "job-01",
      moldNo: "MOLD-01",
      status: "0",
    };

    expect(validateStartPressJobTourStep({
      currentJobRows: [pendingJob],
      driverSession: createDriverSession("Connected"),
      expectedDuration: "1",
      filters: {},
      stepIndex: 0,
    })).toBe("请先确认本次作业班组。");
    expect(validateStartPressJobTourStep({
      currentJobRows: [pendingJob],
      driverSession: createDriverSession("Connected"),
      expectedDuration: "1",
      filters: { teamId: "team-01" },
      stepIndex: 1,
    })).toBe("请选择当前操作员。");
    expect(validateStartPressJobTourStep({
      currentJobRows: [pendingJob],
      driverSession: createDriverSession("Connected"),
      expectedDuration: "1",
      filters: { teamId: "team-01", operatorId: "op-01" },
      stepIndex: 2,
    })).toBe("请选择本次加工工艺。");
    expect(validateStartPressJobTourStep({
      currentJobRows: [{ ...pendingJob, moldNo: "" }],
      driverSession: createDriverSession("Connected"),
      expectedDuration: "1",
      filters,
      stepIndex: 3,
    })).toBe("开始加工前请确认模具已锁定。");
    expect(validateStartPressJobTourStep({
      currentJobRows: [pendingJob],
      driverSession: createDriverSession("Connected"),
      expectedDuration: "",
      filters,
      stepIndex: 4,
    })).toBe("请确认预计加工时长。");
    expect(validateStartPressJobTourStep({
      currentJobRows: [pendingJob],
      driverSession: createDriverSession("Connected"),
      expectedDuration: "1",
      filters,
      stepIndex: 5,
    })).toBeNull();
  });

  /**
   * @brief 断言 start Tour（开始漫游）把 lock mold（锁定模具）按钮作为锁模步骤 target（目标）。
   * @author PopoY
   */
  it("targets the lock mold button from the start processing tour", () => {
    const startTourSource = extractSourceBetween(
      pageSource,
      "const startTourSteps =",
      "const completeTourSteps =",
    );
    const actionTourTargetSource = extractSourceBetween(
      pageSource,
      "const actionButtonTourTargets:",
      "return (",
    );

    expect(pageSource).toContain("lockMoldButtonTourTargetRef");
    expect(startTourSource).toContain("target: createTourTarget(lockMoldButtonTourTargetRef)");
    expect(actionTourTargetSource).toContain("lockMold: lockMoldButtonTourTargetRef");
  });

  /**
   * @brief 断言 lock mold Tour（锁模漫游）覆盖 Mold Lock Drawer（锁模抽屉）里的真实操作链路。
   * @author PopoY
   */
  it("defines mold lock drawer tour targets and handoff from start tour", () => {
    const handleLockMoldSource = extractSourceBetween(
      pageSource,
      "const handleLockMold =",
      "const resetMoldLockPanelState =",
    );
    const lockTourSource = extractSourceBetween(
      pageSource,
      "const lockTourSteps =",
      "const activeTourSteps =",
    );
    const lockDrawerSource = extractSourceBetween(
      pageSource,
      'className="press-job-page__mold-lock-drawer"',
      "</Drawer>",
    );
    const activeTourStepsSource = extractSourceBetween(
      pageSource,
      "const activeTourSteps =",
      "function createTourTarget",
    );

    expect(pageSource).toContain('type PressJobActionButtonKey = PressDeviceActionButtonKey | "lockMold"');
    expect(pageSource).toContain("moldLockInputTourTargetRef");
    expect(pageSource).toContain("moldLockSearchButtonTourTargetRef");
    expect(pageSource).toContain("moldLockInfoTableTourTargetRef");
    expect(pageSource).toContain("moldLockConfirmButtonTourTargetRef");
    expect(handleLockMoldSource).toContain('if (activeTour === "start")');
    expect(handleLockMoldSource).toContain('setActiveTour("lock")');
    expect(lockTourSource).toContain('title: "输入并选择模具号"');
    expect(lockTourSource).toContain('title: "查询模具明细"');
    expect(lockTourSource).toContain('title: "选择明细和工艺"');
    expect(lockTourSource).toContain('title: "执行确认锁定"');
    expect(lockDrawerSource).toContain("锁定模具指导");
    expect(lockDrawerSource).toContain('onClick={() => openPressJobTour("lock")}');
    expect(activeTourStepsSource).toContain('activeTour === "lock"');
    expect(activeTourStepsSource).toContain("lockTourSteps");
  });

  /**
   * @brief 断言 lock mold guidance（锁模指导）按抽屉、候选、明细和选择状态阻止推进。
   * @author PopoY
   */
  it("guards mold lock drawer tour steps", () => {
    const filters = { teamId: "team-01", operatorId: "op-01", processId: "PRESS-01" };
    const moldInfoRow = {
      moldNo: "P123-MOLD-01",
      makeOrderNumber: "MO-001",
      defaultProcessId: "PRESS-01",
    };

    expect(validateLockMoldTourStep({
      currentJobRows: [],
      filters,
      isPanelOpen: false,
      moldInfoRows: [moldInfoRow],
      selectedMoldInfoRow: moldInfoRow,
      selectedMoldNo: "P123-MOLD-01",
      stepIndex: 0,
    })).toBe("请先打开模具锁定面板。");
    expect(validateLockMoldTourStep({
      currentJobRows: [],
      filters,
      isPanelOpen: true,
      moldInfoRows: [moldInfoRow],
      selectedMoldInfoRow: moldInfoRow,
      selectedMoldNo: "",
      stepIndex: 1,
    })).toBe("请先选择候选模具号。");
    expect(validateLockMoldTourStep({
      currentJobRows: [],
      filters,
      isPanelOpen: true,
      moldInfoRows: [],
      selectedMoldInfoRow: null,
      selectedMoldNo: "P123-MOLD-01",
      stepIndex: 2,
    })).toBe("请先搜索模具明细。");
    expect(validateLockMoldTourStep({
      currentJobRows: [],
      filters,
      isPanelOpen: true,
      moldInfoRows: [moldInfoRow],
      selectedMoldInfoRow: null,
      selectedMoldNo: "P123-MOLD-01",
      stepIndex: 3,
    })).toBe("请先选择模具明细。");
    expect(validateLockMoldTourStep({
      currentJobRows: [],
      filters,
      isPanelOpen: true,
      moldInfoRows: [moldInfoRow],
      selectedMoldInfoRow: moldInfoRow,
      selectedMoldNo: "P123-MOLD-01",
      stepIndex: 3,
    })).toBeNull();
  });

  /**
   * @brief 断言锁模提交成功后复用 Panel（面板）关闭逻辑，避免 lock Tour（锁模漫游）残留。
   * @author PopoY
   */
  it("closes lock tour after successful mold lock submit", () => {
    const cancelPanelSource = extractSourceBetween(
      pageSource,
      "const cancelMoldLockPanel =",
      "const loadLockedMoldsOnce =",
    );
    const submitLockSource = extractSourceBetween(
      pageSource,
      "const submitPressMoldLockRequest =",
      "const confirmMoldUnlock =",
    );

    expect(cancelPanelSource).toContain('if (activeTour === "lock")');
    expect(cancelPanelSource).toContain("closePressJobTour();");
    expect(submitLockSource).toContain("cancelMoldLockPanel();");
    expect(submitLockSource).not.toContain("setIsMoldLockPanelOpen(false);");
    expect(submitLockSource).not.toContain("resetMoldLockPanelState();");
  });

  /**
   * @brief 断言完成加工 guidance（指导）按加工中作业和 Driver Session（驱动会话）状态阻止推进。
   * @author PopoY
   */
  it("guards complete processing tour steps", () => {
    const filters = { teamId: "team-01", operatorId: "op-01", processId: "PRESS-01" };
    const runningJob = {
      localJobSessionId: "job-01",
      moldNo: "MOLD-01",
      status: "1",
    };

    expect(validateCompletePressJobTourStep({
      currentJobRows: [{ ...runningJob, status: "0" }],
      driverSession: createDriverSession("Connected"),
      filters,
      stepIndex: 0,
    })).toBe("请先确认当前作业处于加工中。");
    expect(validateCompletePressJobTourStep({
      currentJobRows: [runningJob],
      driverSession: createDriverSession("Disconnected"),
      filters,
      stepIndex: 1,
    })).toBe("Driver Session（驱动会话）未连接，请先恢复驱动连接。");
    expect(validateCompletePressJobTourStep({
      currentJobRows: [runningJob],
      driverSession: createDriverSession("Connected"),
      filters,
      stepIndex: 2,
    })).toBeNull();
  });

  /**
   * @brief 断言 Unlock Drawer（解锁抽屉）内才出现解锁模具 guidance launcher（指导入口）。
   * @author PopoY
   */
  it("defines unlock drawer guidance launcher and targets", () => {
    const unlockDrawerSource = extractSourceBetween(
      pageSource,
      'className="press-job-page__mold-unlock-drawer"',
      "</Drawer>",
    );

    expect(unlockDrawerSource).toContain("解锁模具指导");
    expect(unlockDrawerSource).toContain('onClick={() => openPressJobTour("unlock")}');
    expect(unlockDrawerSource).toContain("unlockLockedTagTourTargetRef");
    expect(unlockDrawerSource).toContain("unlockKeepTagTourTargetRef");
    expect(unlockDrawerSource).toContain("unlockSelectedTagTourTargetRef");
    expect(unlockDrawerSource).toContain("unlockTableTourTargetRef");
    expect(unlockDrawerSource).toContain("unlockConfirmButtonTourTargetRef");
    expect(pageCss).toContain(".press-job-page__mold-unlock-status-row");
    expect(pageCss).toContain("justify-content: space-between");
  });

  /**
   * @brief 断言 Unlock Drawer（解锁抽屉）关闭时同步关闭 unlock Tour（解锁漫游）。
   * @author PopoY
   */
  it("closes unlock tour whenever the unlock drawer closes", () => {
    const cancelDrawerSource = extractSourceBetween(
      pageSource,
      "const cancelMoldUnlockDrawer =",
      "const searchMoldCandidates =",
    );
    const submitUnlockSource = extractSourceBetween(
      pageSource,
      "const submitPressMoldUnlockRequest =",
      "const handleStartProcessing =",
    );

    expect(cancelDrawerSource).toContain('if (activeTour === "unlock")');
    expect(cancelDrawerSource).toContain("closePressJobTour();");
    expect(submitUnlockSource).toContain("cancelMoldUnlockDrawer();");
    expect(submitUnlockSource).not.toContain("setIsMoldUnlockDrawerOpen(false);");
  });

  /**
   * @brief 断言解锁 guidance（指导）按 Drawer（抽屉）、数据、选择和保留规则阻止推进。
   * @author PopoY
   */
  it("guards unlock mold tour steps", () => {
    const lockedMolds = [{ moldNo: "P123-MOLD-01" }, { moldNo: "P123-MOLD-02" }];

    expect(validateUnlockMoldTourStep({
      currentJobRows: [],
      isDrawerOpen: false,
      lockedMolds,
      operatorId: "op-01",
      selectedMoldNos: [],
      stepIndex: 0,
    })).toBe("请先打开解锁抽屉。");
    expect(validateUnlockMoldTourStep({
      currentJobRows: [],
      isDrawerOpen: true,
      lockedMolds: [],
      operatorId: "op-01",
      selectedMoldNos: [],
      stepIndex: 0,
    })).toBe("当前没有可解锁模具。");
    expect(validateUnlockMoldTourStep({
      currentJobRows: [],
      isDrawerOpen: true,
      lockedMolds,
      operatorId: "op-01",
      selectedMoldNos: [],
      stepIndex: 3,
    })).toBe("请先选择需要解锁的模具。");
    expect(validateUnlockMoldTourStep({
      currentJobRows: [{ localJobSessionId: "job-01", status: "1" }],
      isDrawerOpen: true,
      lockedMolds: [{ moldNo: "P123-MOLD-01" }],
      operatorId: "op-01",
      selectedMoldNos: ["P123-MOLD-01"],
      stepIndex: 4,
    })).toBe("当前正在加工不可全部解锁，如需全部解锁请使用完成加工功能。");
  });

  /**
   * @brief 断言开始/完成加工 guidance（指导）各自有独立 Tour steps（漫游步骤）。
   * @author PopoY
   */
  it("defines independent start and complete tour step copy", () => {
    expect(pageSource).toContain("startTourSteps");
    expect(pageSource).toContain("completeTourSteps");
    expect(pageSource).toContain('title: "确认班组"');
    expect(pageSource).toContain('title: "确认人员"');
    expect(pageSource).toContain('title: "确认预选工艺"');
    expect(pageSource).toContain('title: "确认模具锁定"');
    expect(pageSource).toContain('title: "确认预计加工时长"');
    expect(pageSource).toContain('title: "执行开始加工"');
    expect(pageSource).toContain('title: "确认加工中作业"');
    expect(pageSource).toContain('title: "确认实时信号"');
    expect(pageSource).toContain('title: "执行完成加工"');
    expect(pageSource).not.toContain('openPressJobTour("start"); handleStartProcessing');
    expect(pageSource).not.toContain('openPressJobTour("complete"); handleCompleteProcessing');
  });

  /**
   * @brief 断言 ERP lookup data（企业资源计划查询数据）进入班组和默认人员展示。
   * @author PopoY
   */
  it("renders press job lookup options from bootstrap data", () => {
    const html = renderPage(
      <PressJobPage
        bootstrapSession={{
          status: "success",
          config: null,
          data: {
            stationContext: {
              stationAccountId: "station-account-01",
              stationId: "station-01",
            },
            pressJobLookupData: {
              defaultOperatorId: "zhangsan",
              defaultTeamId: "PLINE-A",
              operatorOptions: [
                { operatorId: "zhangsan", operatorName: "张三", teamId: "PLINE-A" },
              ],
              processOptions: [
                { processId: "PRESS-01", processName: "压制作业", teamId: "PLINE-A" },
              ],
              teamOptions: [
                { teamId: "PLINE-A", teamName: "压机一班" },
                { teamId: "PLINE-B", teamName: "压机二班" },
              ],
            },
          },
          error: null,
          retry: async () => {},
        }}
      />,
    );

    expect(pageSource).toContain("pressJobLookupData");
    expect(pageSource).toContain("createInitialPressJobFilterState(pressJobLookupData)");
    expect(pageSource).toContain("pressJobLookupData?.teamOptions");
    expect(pageSource).toContain("label: teamOption.teamName");
    expect(pageSource).toContain("label: operatorOption.operatorName");
    expect(pageSource).toContain("label: processOption.processName");
    expect(pageSource).toContain("loadPressJobTeamOptions");
    expect(html).not.toContain("secret-session-token");
  });

  /**
   * @brief 断言 Current Job Table（当前作业表）展示 bootstrap session（启动会话）里的真实当前作业行。
   * @author PopoY
   */
  it("renders current job rows from bootstrap data without raw device identifiers", () => {
    const html = renderPage(
      <PressJobPage
        bootstrapSession={{
          status: "success",
          config: null,
          data: {
            stationContext: {
              stationAccountId: "station-account-01",
              stationId: "station-01",
            },
            pressJobCurrentJobs: [
              {
                localJobSessionId: "press-job-row-0",
                pressName: "一号压机",
                moldNo: "MOLD-01",
                plannedDurationHours: "2.5",
                actualDurationHours: "1.0",
                startedAt: "2026-06-30 08:00:00",
                status: "1",
              },
            ],
          },
          error: null,
          retry: async () => {},
        }}
      />,
    );

    expect(html).toContain("一号压机");
    expect(html).toContain("MOLD-01");
    expect(html).toContain("2.5");
    expect(html).toContain("aria-label=\"预计时长 一号压机\"");
    expect(html).toContain("1.0");
    expect(html).toContain("2026-06-30 08:00:00");
    expect(html).toContain("未知");
    expect(html).not.toContain("暂无当前作业");
    expect(html).not.toContain("9001");
    expect(html).not.toContain("192.168");
    expect(html).not.toContain("10.0.0.8");
    expect(html).not.toContain("secret-session-token");
  });

  /**
   * @brief 断言 injected currentJobRows（注入当前作业行）优先于 bootstrap current jobs（启动当前作业）。
   * @author PopoY
   */
  it("lets injected current job rows override bootstrap current jobs", () => {
    const html = renderPage(
      <PressJobPage
        bootstrapSession={{
          status: "success",
          config: null,
          data: {
            stationContext: {
              stationAccountId: "station-account-01",
              stationId: "station-01",
            },
            pressJobCurrentJobs: [
              {
                localJobSessionId: "bootstrap-row",
                pressName: "旧压机",
                moldNo: "P000-OLD",
              },
            ],
          },
          error: null,
          retry: async () => {},
        }}
        currentJobRows={[
          {
            localJobSessionId: "injected-row",
            pressName: "注入压机",
            moldNo: "P123-MOLD-01",
          },
        ]}
      />,
    );

    expect(html).toContain("注入压机");
    expect(html).toContain("P123-MOLD-01");
    expect(html).not.toContain("旧压机");
    expect(html).not.toContain("P000-OLD");
  });

  /**
   * @brief PressJobPage（压机作业页）继续从 driverSession（驱动会话）读取实时信号。
   * @author PopoY
   */
  it("renders real-time signals from driver session data", () => {
    const html = renderPage(
      <PressJobPage
        driverSession={{
          status: "success",
          data: {
            applyResult: {
              correlationId: "cid-apply-001",
              resultCode: "OK",
              leaseState: "Active",
              deviceSessionState: "Connected",
            },
            signalSnapshot: {
              correlationId: "signal-snapshot-publisher-001",
              resultCode: "OK",
              signalValues: { pressure: 135 },
            },
          },
          error: null,
          retry: vi.fn(),
          refreshSnapshot: vi.fn(),
        }}
      />,
    );

    expect(html).toContain("实时信号");
    expect(html).toContain("当前信号刷新间隔为10秒");
    expect(html).toContain("刷新成功");
    expect(html).toContain("pressure");
    expect(html).toContain("135");
  });

  /**
   * @brief 断言 unlock mold（解锁模具）入口只出现在 Current Job section header（当前作业标题栏）。
   * @author PopoY
   */
  it("renders the mold unlock button in the current job header only", () => {
    const html = renderPage(
      <PressJobPage
        currentJobRows={[
          {
            localJobSessionId: "job-01",
            moldNo: "P123-MOLD-01",
            pressName: "一号压机",
          },
        ]}
      />,
    );
    const actionSection = extractAriaSectionHtml(html, "压机作业操作区");
    const currentJobSection = extractAriaSectionHtml(html, "当前作业信息");
    const moldNoColumnSource = extractSourceBetween(
      pageSource,
      'title: "模具号"',
      'title: "预计时长(小时)"',
    );

    expect(currentJobSection).toContain("press-job-page__section-title--with-action");
    expect(currentJobSection).toContain("解锁模具");
    expect(actionSection).toContain("锁定模具");
    expect(actionSection).not.toContain("解锁模具");
    expect(moldNoColumnSource).toContain('formatCurrentJobCell(moldNo, "未锁定")');
    expect(moldNoColumnSource).not.toContain("<Button");
    expect(moldNoColumnSource).not.toContain("href");
    expect(moldNoColumnSource).not.toContain("confirmMoldUnlock");
  });

  /**
   * @brief 断言 Unlock Drawer（解锁抽屉）只查询一次 locked molds（已锁定模具）并展示 8 个业务字段。
   * @author PopoY
   */
  it("defines the mold unlock drawer load and table contract", () => {
    const unlockDrawerSource = extractSourceBetween(
      pageSource,
      'className="press-job-page__mold-unlock-drawer"',
      "</Drawer>",
    );

    expect(pageSource).toContain("loadPressLockedMolds?:");
    expect(pageSource).toContain("unlockPressMolds?:");
    expect(pageSource).toContain("recordPressMoldUnlockDiagnostic?:");
    expect(pageSource).toContain("isMoldUnlockDrawerOpen");
    expect(pageSource).toContain("lockedMoldRows");
    expect(pageSource).toContain("selectedUnlockMoldNos");
    expect(pageSource).toContain("lockedMoldsLoading");
    expect(pageSource).toContain("moldUnlockSubmitting");
    expect(pageSource).toContain("lockedMoldLoadVersionRef");
    expect(pageSource).toContain("loadPressLockedMolds({");
    expect(pageSource).toContain("correlationId: createPressMoldUnlockCorrelationId()");
    expect(pageSource).toContain("setLockedMoldRows(nextRows)");
    expect(unlockDrawerSource).toContain('title="解锁模具"');
    expect(unlockDrawerSource).toContain("已锁定 {lockedMoldRows.length} 套");
    expect(unlockDrawerSource).toContain("加工中需保留 1 套");
    expect(unlockDrawerSource).toContain("已选 {selectedUnlockMoldNos.length} 套");
    expect(unlockDrawerSource).toContain("rowSelection={lockedMoldRowSelection}");
    expect(unlockDrawerSource).toContain("onRow={(row) => ({");
    expect(unlockDrawerSource).toContain("toggleUnlockMoldRow(row.moldNo)");
    expect(unlockDrawerSource).toContain("暂无已锁定模具");
    expect(unlockDrawerSource).toContain("icon={createMoldUnlockCancelIcon()}");
    expect(unlockDrawerSource).toContain("icon={createMoldUnlockConfirmIcon()}");
    expect(unlockDrawerSource).not.toContain(">刷新<");
    expect(pageSource).toContain("const pressMoldWorkTypeOptions =");
    expect(pageSource).toContain("const pressMoldCraftOptions =");
    expect(pageSource).toContain("const pressMoldOperatorOptions =");
    expect(pageSource).toContain("pressMoldCraftOptions");
    expect(pageSource).toContain("pressMoldOperatorOptions");
    expect(pageSource).toContain("formatPressLockedMoldWorkType(row, pressMoldWorkTypeOptions)");
    expect(pageSource.match(/createMoldUnlockIcon\(\)/g)?.length ?? 0).toBeGreaterThanOrEqual(2);
    for (const title of [
      'title: "模具号"',
      'title: "工序号"',
      'title: "制造令号"',
      'title: "工艺名称"',
      'title: "工时类型"',
      'title: "开始时间"',
      'title: "作业员"',
      'title: "操作"',
    ]) {
      expect(pageSource).toContain(title);
    }
  });

  /**
   * @brief 断言 unlock drawer（解锁抽屉）的解锁、确认解锁和取消按钮使用语义化 icon（图标）。
   * @author PopoY
   */
  it("uses semantic icons for the mold unlock actions", () => {
    expect(pageSource).toContain('from "@ant-design/icons"');
    expect(pageSource).toContain("UnlockOutlined");
    expect(pageSource).toContain("CheckOutlined");
    expect(pageSource).toContain("CloseOutlined");
    expect(pageSource).toContain("icon={createMoldUnlockIcon()}");
    expect(pageSource).toContain("icon={createMoldUnlockCancelIcon()}");
    expect(pageSource).toContain("icon={createMoldUnlockConfirmIcon()}");
  });

  /**
   * @brief 断言 row unlock（行内解锁）和 batch unlock（批量解锁）共用 confirm/submit（确认/提交）路径。
   * @author PopoY
   */
  it("uses one confirm and submit path for row and batch mold unlock", () => {
    expect(pageSource).toContain("const confirmMoldUnlock = (moldNos: string[]) =>");
    expect(pageSource).toContain("validatePressMoldUnlockSelection({");
    expect(pageSource).toContain("createPressMoldUnlockRequest(");
    expect(pageSource).toContain("modal.confirm({");
    expect(pageSource).toContain("onOk: () => submitPressMoldUnlockRequest(request)");
    expect(pageSource).toContain("confirmMoldUnlock([row.moldNo])");
    expect(pageSource).toContain("onClick={() => confirmMoldUnlock(selectedUnlockMoldNos)}");
    expect(pageSource).toContain("submitPressMoldUnlockWithRefresh({");
    expect(pageSource).toContain("unlockPressMolds");
    expect(pageSource).toContain("refreshPressJobCurrentJobs");
    expect(pageSource).toContain("recordPressMoldUnlockDiagnostic");
    expect(pageSource).toContain("setIsMoldUnlockDrawerOpen(false)");
    expect(pageSource).toContain("resetMoldUnlockDrawerState()");
  });

  /**
   * @brief 断言解锁模具字典翻译优先使用 sam-erp 同源 dictionary（字典）列表。
   * @author PopoY
   */
  it("formats locked mold craft, operator, and work type through dictionaries", () => {
    const row = {
      moldNo: "P123-MOLD-01",
      craftCode: "PRESS-01",
      operatorId: "zhangsan",
      workTimeType: "1",
    };

    expect(
      formatPressLockedMoldCraftName(row, [
        { processId: "PRESS-01", processName: "冲压成型", teamId: "PLINE-A" },
      ]),
    ).toBe("冲压成型");
    expect(
      formatPressLockedMoldOperatorName(row, [
        { operatorId: "zhangsan", operatorName: "张三", teamId: "PLINE-A" },
      ]),
    ).toBe("张三");
    expect(
      formatPressLockedMoldWorkType(row, [
        { dictValue: "1", dictLabel: "正常作业" },
      ]),
    ).toBe("正常作业");
    expect(
      formatPressLockedMoldCraftName({ ...row, craftCode: "WX1" }, [], [
        { dictValue: "WX1", dictLabel: "外协一" },
      ]),
    ).toBe("外协一");
    expect(
      formatPressLockedMoldOperatorName({ ...row, operatorId: "liangy" }, [], [
        { dictValue: "liangy", dictLabel: "梁燕" },
      ]),
    ).toBe("梁燕");
    expect(
      formatPressLockedMoldCraftName({ moldNo: "MOLD-02", craftName: "后端工艺" }, []),
    ).toBe("后端工艺");
  });

  /**
   * @brief 断言锁模前置 validation（校验）按班组、人员、预选工艺和五套上限顺序返回中文提示。
   * @author PopoY
   */
  it("validates mold lock preflight before opening the panel", () => {
    expect(validateMoldLockPreflight({ operatorId: "op-01", processId: "PRESS-01" }, [])).toBe("请选择班组");
    expect(validateMoldLockPreflight({ teamId: "team-01", processId: "PRESS-01" }, [])).toBe("请选择人员");
    expect(validateMoldLockPreflight({ teamId: "team-01", operatorId: "op-01" }, [])).toBe("请选择预选工艺");
    expect(
      validateMoldLockPreflight(
        { teamId: "team-01", operatorId: "op-01", processId: "PRESS-01" },
        Array.from({ length: 5 }, (_value, index) => ({
          localJobSessionId: `job-${index}`,
          moldNo: `P123-MOLD-${index}`,
        })),
      ),
    ).toBe("当前已锁定五套模具,已达到上限!");
    expect(
      validateMoldLockPreflight(
        { teamId: "team-01", operatorId: "op-01", processId: "PRESS-01" },
        [{ localJobSessionId: "job-01", moldNo: "P123-MOLD-01" }],
      ),
    ).toBeNull();
  });

  /**
   * @brief 断言候选模具 selection（选择）只保留白名单字段，并在候选工艺为空时使用当前预选工艺。
   * @author PopoY
   */
  it("creates a mold lock selection with the current process as fallback craft", () => {
    expect(
      resolveMoldInfoRowProcessId(
        { moldNo: "P123-MOLD-02", defaultProcessId: " PRESS-02 " },
        "PRESS-01",
      ),
    ).toBe("PRESS-02");
    expect(resolveMoldInfoRowProcessId({ moldNo: "P123-MOLD-03" }, "PRESS-01")).toBe("PRESS-01");
    expect(
      createPressMoldLockSelection(
        {
          moldNo: "P123-MOLD-01",
          makeOrderNumber: "MO-001",
          stages: "10",
          projectCode: "P123",
          name: "前模",
        },
        "PRESS-01",
      ),
    ).toEqual({
      moldNo: "P123-MOLD-01",
      makeOrderNumber: "MO-001",
      stages: "10",
      craftCode: "PRESS-01",
      projectCode: "P123",
    });
  });

  /**
   * @brief 断言锁模 selection validation（选择校验）阻止空选择、空制造令/工艺和跨项目。
   * @author PopoY
   */
  it("validates mold lock selection before any backend submit is wired", () => {
    expect(validatePressMoldLockSelection(null, [])).toBe("请先选择模具。");
    expect(
      validatePressMoldLockSelection(
        {
          moldNo: "P123-MOLD-01",
          makeOrderNumber: "",
          craftCode: "PRESS-01",
        },
        [],
      ),
    ).toBe("制造令号与工艺不能为空。");
    expect(
      validatePressMoldLockSelection(
        {
          moldNo: "P456-MOLD-02",
          makeOrderNumber: "MO-002",
          craftCode: "PRESS-01",
          projectCode: "P456",
        },
        [{ localJobSessionId: "job-01", moldNo: "P123-MOLD-01" }],
      ),
    ).toBe("不可跨项目作业！当前设备正在作业项目 [P123]，所选模具属于项目 [P456]");
    expect(
      validatePressMoldLockSelection(
        {
          moldNo: "P123-MOLD-02",
          makeOrderNumber: "MO-002",
          craftCode: "PRESS-01",
        },
        [{ localJobSessionId: "job-01", moldNo: "P123-MOLD-01" }],
      ),
    ).toBeNull();
  });

  /**
   * @brief 断言确认锁模 request（请求）只包含 Task3（任务三）允许提交的字段。
   * @author PopoY
   */
  it("creates a single-row mold lock request without raw device fields", () => {
    const request = createPressMoldLockRequest(
      {
        teamId: "PLINE-01",
        operatorId: "zhangsan",
        processId: "CRAFT-001",
      },
      {
        moldNo: "MOLD-01",
        makeOrderNumber: "MO-001",
        stages: "OP10",
        craftCode: "CRAFT-001",
        projectCode: "P123",
      },
      "press-mold-lock-01",
    );

    expect(request).toEqual({
      teamId: "PLINE-01",
      operatorId: "zhangsan",
      processId: "CRAFT-001",
      selectedRows: [
        {
          moldNo: "MOLD-01",
          makeOrderNumber: "MO-001",
          stages: "OP10",
          craftCode: "CRAFT-001",
          projectCode: "P123",
        },
      ],
      correlationId: "press-mold-lock-01",
    });
    expect(JSON.stringify(request)).not.toContain("deviceId");
    expect(JSON.stringify(request)).not.toContain("ip");
    expect(JSON.stringify(request)).not.toContain("port");
  });

  /**
   * @brief 断言锁模错误消息只展示中文业务错误或统一兜底文案。
   * @author PopoY
   */
  it("maps mold lock errors to sanitized Chinese feedback", () => {
    expect(
      resolvePressMoldLockErrorMessage(
        new Error("模具号 MOLD-01 已存在，请检查后重试。"),
      ),
    ).toBe("模具号 MOLD-01 已存在，请检查后重试。");
    expect(
      resolvePressMoldLockErrorMessage(
        new Error("错误码 ERP:1001，模具号已存在，请检查后重试。"),
      ),
    ).toBe("错误码 ERP:1001，模具号已存在，请检查后重试。");
    expect(resolvePressMoldLockErrorMessage(new Error("HTTP 500 raw stack"))).toBe(
      "锁定失败，请查看诊断信息后重试。",
    );
    expect(resolvePressMoldLockErrorMessage(new Error("会话令牌 secret 已过期"))).toBe(
      "锁定失败，请查看诊断信息后重试。",
    );
    expect(resolvePressMoldLockErrorMessage(new Error("签名原文 abc 校验失败"))).toBe(
      "锁定失败，请查看诊断信息后重试。",
    );
    expect(resolvePressMoldLockErrorMessage(new Error("私钥 abc 无效"))).toBe(
      "锁定失败，请查看诊断信息后重试。",
    );
    expect(resolvePressMoldLockErrorMessage(new Error("信号配置 abc 异常"))).toBe(
      "锁定失败，请查看诊断信息后重试。",
    );
    expect(resolvePressMoldLockErrorMessage(new Error("token abc 已过期"))).toBe(
      "锁定失败，请查看诊断信息后重试。",
    );
    expect(resolvePressMoldLockErrorMessage(new Error("accessToken abc 已过期"))).toBe(
      "锁定失败，请查看诊断信息后重试。",
    );
    expect(
      resolvePressMoldLockErrorMessage(new Error("session token abc 已过期")),
    ).toBe("锁定失败，请查看诊断信息后重试。");
    expect(resolvePressMoldLockErrorMessage(new Error("设备 ID abc 不存在"))).toBe(
      "锁定失败，请查看诊断信息后重试。",
    );
    expect(
      resolvePressMoldLockErrorMessage(
        new Error("压机 192.168.1.10:9001 已被占用，请联系管理员。"),
      ),
    ).toBe("锁定失败，请查看诊断信息后重试。");
    expect(resolvePressMoldLockErrorMessage({ responseBody: "raw payload" })).toBe(
      "锁定失败，请查看诊断信息后重试。",
    );
  });

  /**
   * @brief 断言锁模成功但 current jobs refresh（当前作业刷新）失败时不误报锁模失败。
   * @author PopoY
   */
  it("does not classify refresh failure after a successful mold lock as lock failure", async () => {
    const recordPressMoldLockDiagnostic = vi.fn();
    const request = createPressMoldLockRequest(
      {
        teamId: "PLINE-01",
        operatorId: "zhangsan",
        processId: "CRAFT-001",
      },
      {
        moldNo: "MOLD-01",
        makeOrderNumber: "MO-001",
        craftCode: "CRAFT-001",
      },
      "press-mold-lock-01",
    );

    await expect(
      submitPressMoldLockWithRefresh({
        lockPressMold: vi.fn().mockResolvedValue({ lockedMoldNos: ["MOLD-01"] }),
        refreshPressJobCurrentJobs: vi
          .fn()
          .mockRejectedValue(new Error("HTTP 500 refresh failed")),
        recordPressMoldLockDiagnostic,
        request,
        now: () => 100,
      }),
    ).resolves.toBe("CURRENT_JOB_REFRESH_FAILED");

    expect(recordPressMoldLockDiagnostic).toHaveBeenCalledWith({
      correlationId: "press-mold-lock-01",
      durationMs: 0,
      moldNo: "MOLD-01",
      operatorId: "zhangsan",
      teamId: "PLINE-01",
      processId: "CRAFT-001",
      resultCode: "CURRENT_JOB_REFRESH_FAILED",
    });
    expect(recordPressMoldLockDiagnostic).not.toHaveBeenCalledWith(
      expect.objectContaining({ resultCode: "ERP_MOLD_LOCK_FAILED" }),
    );
  });

  /**
   * @brief 断言锁模 diagnostic summary（诊断摘要）只保留白名单字段。
   * @author PopoY
   */
  it("creates a whitelisted mold lock diagnostic summary", () => {
    const summary = createPressMoldLockDiagnosticSummary({
      correlationId: "press-mold-lock-01",
      moldNo: "MOLD-01",
      operatorId: "zhangsan",
      teamId: "PLINE-01",
      processId: "CRAFT-001",
      commandName: "pressMoldLock",
      durationMs: 28,
      resultCode: "OK",
      stationAccountId: "station-a",
      selectedRows: [{ moldNo: "MOLD-01" }],
      rawResponse: { token: "secret-token" },
      sessionToken: "secret-token",
      signedLease: "secret-lease",
      signalConfig: "secret-config",
    });

    expect(summary).toEqual({
      correlationId: "press-mold-lock-01",
      moldNo: "MOLD-01",
      operatorId: "zhangsan",
      teamId: "PLINE-01",
      processId: "CRAFT-001",
      commandName: "pressMoldLock",
      durationMs: 28,
      resultCode: "OK",
      stationAccountId: "station-a",
    });
    expect(JSON.stringify(summary)).not.toContain("selectedRows");
    expect(JSON.stringify(summary)).not.toContain("rawResponse");
    expect(JSON.stringify(summary)).not.toContain("secret-token");
    expect(JSON.stringify(summary)).not.toContain("secret-lease");
    expect(JSON.stringify(summary)).not.toContain("secret-config");
  });

  /**
   * @brief 断言解锁模具 selection（选择）校验覆盖空数据、空选择和最后一套保护。
   * @author PopoY
   */
  it("validates mold unlock selection before submit", () => {
    const lockedMolds = [
      { moldNo: "P123-MOLD-01" },
      { moldNo: "P123-MOLD-02" },
    ];

    expect(
      validatePressMoldUnlockSelection({
        lockedMolds: [],
        operatorId: "zhangsan",
        selectedMoldNos: ["P123-MOLD-01"],
        currentJobRows: [],
      }),
    ).toBe("当前没有可解锁模具。");
    expect(
      validatePressMoldUnlockSelection({
        lockedMolds,
        operatorId: "zhangsan",
        selectedMoldNos: [],
        currentJobRows: [],
      }),
    ).toBe("请先选择要解锁的模具。");
    expect(
      validatePressMoldUnlockSelection({
        lockedMolds: [{ moldNo: "P123-MOLD-01" }],
        operatorId: "zhangsan",
        selectedMoldNos: ["P123-MOLD-01"],
        currentJobRows: [{ localJobSessionId: "job-01", status: "1" }],
      }),
    ).toBe("当前正在加工不可全部解锁，如需全部解锁请使用完成加工功能。");
    expect(
      validatePressMoldUnlockSelection({
        lockedMolds: [{ moldNo: "P123-MOLD-01" }],
        operatorId: "zhangsan",
        selectedMoldNos: ["P123-MOLD-01"],
        currentJobRows: [{ localJobSessionId: "job-01", status: "3" }],
      }),
    ).toBe("当前正在加工不可全部解锁，如需全部解锁请使用完成加工功能。");
    expect(
      validatePressMoldUnlockSelection({
        lockedMolds,
        operatorId: "zhangsan",
        selectedMoldNos: ["P123-MOLD-01", "P123-MOLD-02"],
        currentJobRows: [{ localJobSessionId: "job-01", status: "进行中" }],
      }),
    ).toBe("当前正在加工不可全部解锁，如需全部解锁请使用完成加工功能。");
    expect(
      validatePressMoldUnlockSelection({
        lockedMolds,
        operatorId: "zhangsan",
        selectedMoldNos: ["P123-MOLD-01", "P123-MOLD-02"],
        currentJobRows: [{ localJobSessionId: "job-01" }],
      }),
    ).toBe("当前正在加工不可全部解锁，如需全部解锁请使用完成加工功能。");
    expect(
      validatePressMoldUnlockSelection({
        lockedMolds,
        operatorId: "   ",
        selectedMoldNos: ["P123-MOLD-01"],
        currentJobRows: [{ localJobSessionId: "job-01", status: "待加工" }],
      }),
    ).toBe("请选择人员");
    expect(
      validatePressMoldUnlockSelection({
        lockedMolds,
        operatorId: "zhangsan",
        selectedMoldNos: ["P123-MOLD-01", "P123-MOLD-02"],
        currentJobRows: [{ localJobSessionId: "job-01", status: "待加工" }],
      }),
    ).toBeNull();
    expect(
      validatePressMoldUnlockSelection({
        lockedMolds,
        operatorId: "zhangsan",
        selectedMoldNos: ["P123-MOLD-01", "P123-MOLD-01"],
        currentJobRows: [{ localJobSessionId: "job-01", status: "进行中" }],
      }),
    ).toBeNull();
    expect(
      validatePressMoldUnlockSelection({
        lockedMolds,
        operatorId: "zhangsan",
        selectedMoldNos: ["P123-MOLD-01", "P999-FOREIGN"],
        currentJobRows: [{ localJobSessionId: "job-01", status: "待加工" }],
      }),
    ).toBe("请先选择要解锁的模具。");
  });

  /**
   * @brief 断言解锁模具 request（请求）只包含 ERP contract（接口契约）字段。
   * @author PopoY
   */
  it("creates a mold unlock request without raw device fields", () => {
    const request = createPressMoldUnlockRequest(
      {
        operatorId: "zhangsan",
        teamId: "PLINE-01",
        processId: "PRESS-01",
      },
      ["P123-MOLD-01", "", "P123-MOLD-02", "P123-MOLD-01"],
      "press-mold-unlock-01",
    );

    expect(request).toEqual({
      operatorId: "zhangsan",
      moldNos: ["P123-MOLD-01", "P123-MOLD-02"],
      correlationId: "press-mold-unlock-01",
    });
    expect(Object.keys(request).sort()).toEqual([
      "correlationId",
      "moldNos",
      "operatorId",
    ]);
    expect(JSON.stringify(request)).not.toContain("deviceId");
    expect(JSON.stringify(request)).not.toContain("ip");
    expect(JSON.stringify(request)).not.toContain("port");
  });

  /**
   * @brief 断言解锁成功但 current jobs refresh（当前作业刷新）失败时不误报解锁失败。
   * @author PopoY
   */
  it("does not classify refresh failure after a successful mold unlock as unlock failure", async () => {
    const recordPressMoldUnlockDiagnostic = vi.fn();
    const request = createPressMoldUnlockRequest(
      { operatorId: "zhangsan" },
      ["P123-MOLD-01"],
      "press-mold-unlock-01",
    );

    await expect(
      submitPressMoldUnlockWithRefresh({
        unlockPressMolds: vi
          .fn()
          .mockResolvedValue({ unlockedMoldNos: ["P123-MOLD-01"] }),
        refreshPressJobCurrentJobs: vi
          .fn()
          .mockRejectedValue(new Error("HTTP 500 refresh failed")),
        recordPressMoldUnlockDiagnostic,
        request,
        now: () => 100,
      }),
    ).resolves.toBe("CURRENT_JOB_REFRESH_FAILED");

    expect(recordPressMoldUnlockDiagnostic).toHaveBeenCalledWith({
      correlationId: "press-mold-unlock-01",
      durationMs: 0,
      moldNos: ["P123-MOLD-01"],
      operatorId: "zhangsan",
      resultCode: "CURRENT_JOB_REFRESH_FAILED",
    });
    expect(recordPressMoldUnlockDiagnostic).not.toHaveBeenCalledWith(
      expect.objectContaining({ resultCode: "ERP_MOLD_UNLOCK_FAILED" }),
    );
  });

  /**
   * @brief 断言解锁错误消息只展示安全中文业务错误。
   * @author PopoY
   */
  it("maps mold unlock errors to sanitized Chinese feedback", () => {
    expect(
      resolvePressMoldUnlockErrorMessage(
        new Error("模具已被其他人员解锁，请刷新后重试。"),
      ),
    ).toBe("模具已被其他人员解锁，请刷新后重试。");
    expect(
      resolvePressMoldUnlockErrorMessage(new Error("sessionToken abc 已过期")),
    ).toBe("解锁失败，请查看诊断信息后重试。");
    expect(
      resolvePressMoldUnlockErrorMessage(
        new Error("压机 192.168.1.10:9001 解锁失败。"),
      ),
    ).toBe("解锁失败，请查看诊断信息后重试。");
    expect(resolvePressMoldUnlockErrorMessage({ rawResponse: "secret" })).toBe(
      "解锁失败，请查看诊断信息后重试。",
    );
  });

  /**
   * @brief 断言解锁 diagnostic summary（诊断摘要）只保留白名单字段。
   * @author PopoY
   */
  it("creates a whitelisted mold unlock diagnostic summary", () => {
    const summary = createPressMoldUnlockDiagnosticSummary({
      correlationId: "press-mold-unlock-01",
      durationMs: 30,
      moldNos: ["P123-MOLD-01"],
      operatorId: "zhangsan",
      commandName: "pressMoldUnlock",
      resultCode: "OK",
      stationAccountId: "station-a",
      deviceId: "raw-device-01",
      rawResponse: { token: "secret-token" },
      selectedRows: [{ moldNo: "P123-MOLD-01" }],
      sessionToken: "secret-token",
    });

    expect(summary).toEqual({
      correlationId: "press-mold-unlock-01",
      durationMs: 30,
      moldNos: ["P123-MOLD-01"],
      operatorId: "zhangsan",
      commandName: "pressMoldUnlock",
      resultCode: "OK",
      stationAccountId: "station-a",
    });
    expect(JSON.stringify(summary)).not.toContain("raw-device-01");
    expect(JSON.stringify(summary)).not.toContain("rawResponse");
    expect(JSON.stringify(summary)).not.toContain("selectedRows");
    expect(JSON.stringify(summary)).not.toContain("secret-token");
  });

  /**
   * @brief 断言 remote search（远程查询）参数包含模具号、已锁定模具和 correlationId（关联 ID）。
   * @author PopoY
   */
  it("creates a mold candidate search input with locked molds and correlation id", () => {
    expect(
      createPressMoldCandidateSearchInput(
        "  P123-MOLD  ",
        [
          { localJobSessionId: "job-01", moldNo: "P123-001" },
          { localJobSessionId: "job-02", moldNo: "" },
          { localJobSessionId: "job-03", moldNo: "P123-002" },
        ],
        "cid-search-01",
      ),
    ).toEqual({
      moldNo: "P123-MOLD",
      lockedMoldNos: ["P123-001", "P123-002"],
      correlationId: "cid-search-01",
    });
  });

  /**
   * @brief 断言 detail search（明细查询）参数复用锁模安全边界，但 endpoint（端点）由 ERP client（客户端）单独决定。
   * @author PopoY
   */
  it("creates a mold info search input after a candidate is selected", () => {
    expect(
      createPressMoldInfoSearchInput(
        "  P123-MOLD  ",
        [
          { localJobSessionId: "job-01", moldNo: "P123-001" },
          { localJobSessionId: "job-02", moldNo: "" },
        ],
        "cid-info-01",
      ),
    ).toEqual({
      moldNo: "P123-MOLD",
      lockedMoldNos: ["P123-001"],
      correlationId: "cid-info-01",
    });
  });

  /**
   * @brief 断言锁模面板使用 injected search（注入查询）、单选表格和安全字段展示。
   * @author PopoY
   */
  it("renders the mold lock panel contract without exposing raw ERP response fields", () => {
    expect(pageSource).toContain('title="模具锁定面板"');
    expect(pageSource).not.toContain('title="Mold Lock Panel');
    expect(pageSource).toContain("isMoldLockPanelOpen");
    expect(pageSource).toContain("moldSearchText");
    expect(pageSource).toContain("moldCandidates");
    expect(pageSource).toContain("moldInfoRows");
    expect(pageSource).toContain("updateMoldInfoRowProcess");
    expect(pageSource).toContain("selectedMoldNo");
    expect(pageSource).toContain("selectedMoldInfoRowIndex");
    expect(pageSource).toContain("moldCandidateLoading");
    expect(pageSource).toContain("moldInfoLoading");
    expect(pageSource).toContain("searchPressMoldCandidates");
    expect(pageSource).toContain("searchPressMoldInfoRows");
    expect(pageSource).toContain("handleMoldSearchTextChange");
    expect(pageSource).toContain("handleMoldNoKeypadFocus");
    expect(pageSource).toContain("moldCandidateOptions");
    expect(pageSource).toContain("handleMoldCandidateSelect");
    expect(pageSource).toContain("handleMoldCandidateSelectByMoldNo");
    expect(pageSource).toContain("setMoldSearchText(candidate.moldNo)");
    expect(pageSource).toContain('specialKey="-"');
    expect(pageSource).toContain("confirmMoldNoSearch");
    expect(pageSource).toContain("onConfirm={confirmMoldNoSearch}");
    expect(pageSource).toContain("confirmMoldInfoSearch");
    expect(pageSource).toContain("createPressMoldInfoSearchInput");
    expect(pageSource).toContain("搜索");
    expect(pageSource).not.toContain(">\n              确定\n            </Button>");
    expect(pageSource).not.toContain("searchTimer");
    expect(pageSource).toContain("lockedMoldNos");
    expect(pageSource).toContain("correlationId");
    expect(pageSource).toContain("press-job-page__mold-select-popup");
    expect(pageSource).toContain("press-job-page__mold-process-select-popup");
    expect(pageSource).toContain("press-job-page__mold-process-select");
    expect(pageSource).toContain('title: "选择工艺"');
    expect(pageSource).toContain("options={processOptions}");
    expect(pageSource).toContain("resolveMoldInfoRowProcessId(row, filters.processId)");
    expect(pageSource).not.toContain("press-job-page__mold-candidate-panel");
    expect(pageSource).toContain("press-job-page__mold-info-table");
    expect(pageSource).toContain("rowSelection={moldInfoRowSelection}");
    expect(pageSource).toContain("resetMoldLockPanelState");
    expect(pageSource).toContain("lockPressMold");
    expect(pageSource).toContain("refreshPressJobCurrentJobs");
    expect(pageSource).toContain("recordPressMoldLockDiagnostic");
    expect(pageSource).toContain("是否确认锁定「");
    expect(pageSource).toContain("锁定完成");
    expect(pageSource).toContain("锁定失败，请查看诊断信息后重试。");
    expect(pageSource).not.toContain("bootstrapSession.data.sessionToken");
    expect(pageSource).not.toContain("bootstrapSession.data?.sessionToken");
    expect(pageSource).not.toContain("bootstrapSession.data.signedLease");
    expect(pageSource).not.toContain("bootstrapSession.data.signalConfig");
  });

  /**
   * @brief 断言预计时长列使用 input（输入框）并通过 NumericKeypad（数字键盘）编辑。
   * @author PopoY
   */
  it("uses a numeric keypad input for planned duration cells", () => {
    expect(pageSource).toContain("NumericKeypad");
    expect(pageSource).toContain("plannedDurationDrafts");
    expect(pageSource).toContain("handlePlannedDurationFocus");
    expect(pageSource).toContain("handlePlannedDurationBlur");
    expect(pageSource).toContain("handlePlannedDurationKeypadChange");
    expect(pageSource).toContain("setActivePlannedDurationRowId(null)");
    expect(pageSource).toContain("activePlannedDurationInputRef");
    expect(pageSource).toContain("finishPlannedDurationKeypad");
    expect(pageSource).toContain("plannedDurationInput?.blur()");
    expect(pageCss).toContain(".press-job-page__planned-duration-input");
    expect(pageCss).toContain("width: 88px");
    expect(pageCss).toContain("min-height: 28px");
    expect(pageCss).toContain("padding-block: 2px");
    expect(pageCss).toContain(".numeric-keypad");
    expect(pageCss).toContain("grid-template-columns: repeat(3, 1fr)");
    expect(pageCss).toContain("width: 248px");
    expect(pageCss).toContain("min-height: 40px");
    expect(pageCss).toContain('[data-theme="dark"] .numeric-keypad');
    expect(pageCss).toContain("background: #242428");
    expect(pageCss).toContain('[data-theme="dark"] .numeric-keypad__key.ant-btn');
    expect(pageSource).toContain("resolveNumericKeypadPosition");
    expect(pageSource).toContain("style={plannedDurationKeypadPosition}");
    expect(pageCss).not.toContain("bottom: 16px");
    expect(pageCss).not.toContain("transform: translateX(-50%)");
  });

  /**
   * @brief 断言 NumericKeypad（数字键盘）跟随触发 input（输入框）位置。
   * @author PopoY
   */
  it("positions the numeric keypad near the focused planned duration input", () => {
    expect(
      resolveNumericKeypadPosition(
        { left: 320, top: 220, bottom: 256 },
        1280,
        720,
      ),
    ).toEqual({ left: 320, top: 264 });
    expect(
      resolveNumericKeypadPosition(
        { left: 1200, top: 220, bottom: 256 },
        1280,
        720,
      ),
    ).toEqual({ left: 1020, top: 264 });
    expect(
      resolveNumericKeypadPosition(
        { left: 320, top: 620, bottom: 656 },
        1280,
        720,
      ),
    ).toEqual({ left: 320, top: 360 });
  });

  /**
   * @brief 断言预计时长 draft（草稿）确认时会规整为合法 decimal number（十进制数字）展示。
   * @author PopoY
   */
  it("normalizes planned duration drafts before closing the keypad", () => {
    expect(normalizePlannedDurationInput("1a2..3")).toBe("12.3");
    expect(normalizePlannedDurationInput("-1")).toBe("-1");
    expect(commitPlannedDurationInput(".")).toBe("");
    expect(commitPlannedDurationInput("2.")).toBe("2");
    expect(commitPlannedDurationInput(".5")).toBe("0.5");
    expect(commitPlannedDurationInput("-1")).toBe("-1");
  });

  /**
   * @brief 断言 scalar（标量）是否出线信号按明确布尔语义展示，操作区与表格保持一致。
   * @author PopoY
   */
  it.each([
    [false, "已入线", "success"],
    [0, "已入线", "success"],
    ["0", "已入线", "success"],
    ["false", "已入线", "success"],
    [true, "已出线", "error"],
    [1, "已出线", "error"],
    ["1", "已出线", "error"],
    ["true", "已出线", "error"],
  ])("renders line status value %j as %s", (value, statusText, color) => {
    const html = renderPressJobLineStatus({ "是否出线": value });
    const statusHtml = [
      extractAriaSectionHtml(html, "压机作业操作区"),
      extractAriaSectionHtml(html, "当前作业信息"),
    ].join("\n");

    expect(statusHtml.match(new RegExp(statusText, "g"))).toHaveLength(2);
    expect(statusHtml.match(new RegExp(`ant-tag-${color}`, "g"))).toHaveLength(2);
  });

  /**
   * @brief 断言 direct key（直接映射键）的值对象读取 value（值），不得把对象本身误判为未知。
   * @author PopoY
   */
  it.each([
    [false, "已入线"],
    [0, "已入线"],
    ["0", "已入线"],
    ["false", "已入线"],
    [true, "已出线"],
    [1, "已出线"],
    ["1", "已出线"],
    ["true", "已出线"],
  ])("unwraps direct-key object value %j as %s", (value, statusText) => {
    const html = renderPressJobLineStatus({ "是否出线": { value } });
    const statusHtml = [
      extractAriaSectionHtml(html, "压机作业操作区"),
      extractAriaSectionHtml(html, "当前作业信息"),
    ].join("\n");

    expect(statusHtml.match(new RegExp(statusText, "g"))).toHaveLength(2);
  });

  /**
   * @brief 断言 metadata（元数据）对象可通过三种名称字段定位是否出线信号，map key（映射键）可保持 signalCode（信号编码）。
   * @author PopoY
   */
  it.each(["signalName", "name", "semanticKey"])(
    "locates line status by object field %s",
    (fieldName) => {
      const html = renderPressJobLineStatus({
        LINE_STATUS_CODE: {
          [fieldName]: "是否出线",
          signalCode: "LINE_STATUS_CODE",
          value: true,
        },
      });
      const statusHtml = [
        extractAriaSectionHtml(html, "压机作业操作区"),
        extractAriaSectionHtml(html, "当前作业信息"),
      ].join("\n");

      expect(statusHtml.match(/已出线/g)).toHaveLength(2);
      expect(statusHtml.match(/ant-tag-error/g)).toHaveLength(2);
    },
  );

  /**
   * @brief 断言缺失或不可识别的是否出线信号保持 neutral（中性）未知状态，不回退 ERP status（状态）误报。
   * @author PopoY
   */
  it.each([
    {},
    { "是否出线": "yes" },
    { LINE_STATUS_CODE: { signalName: "其他信号", value: true } },
  ])("renders unknown for missing or unrecognized line status %#", (signalValues) => {
    const html = renderPressJobLineStatus(signalValues);
    const statusHtml = [
      extractAriaSectionHtml(html, "压机作业操作区"),
      extractAriaSectionHtml(html, "当前作业信息"),
    ].join("\n");

    expect(statusHtml.match(/未知/g)).toHaveLength(2);
    expect(statusHtml).not.toContain("已入线");
    expect(statusHtml).not.toContain("已出线");
    expect(statusHtml).not.toContain("ant-tag-success");
    expect(statusHtml).not.toContain("ant-tag-error");
  });

  /**
   * @brief 断言实时是否出线状态只替换展示，ERP status（状态）仍驱动既有流程判断与实际时长。
   * @author PopoY
   */
  it("keeps ERP status for workflow guards and actual duration", () => {
    const currentJobColumnsSource = extractSourceBetween(
      pageSource,
      "const currentJobColumns:",
      "const moldInfoColumns:",
    );

    expect(pageSource).toContain("resolvePressJobLineStatus(signalValues)");
    expect(currentJobColumnsSource).toContain(
      "formatPressJobActualDurationHours(row.startedAt, Date.now(), row.status)",
    );
    expect(pageSource).toContain('row?.status?.trim() === "0"');
    expect(pageSource).toContain('row?.status?.trim() === "1"');
  });

  /**
   * @brief 断言 NumericKeypad（数字键盘）确认复用规整与校验，并按 pressJobId（压机作业 ID）保存或仅保留本地值。
   * @author PopoY
   */
  it("saves normalized planned duration through the injected ERP callback", () => {
    const plannedDurationSource = extractSourceBetween(
      pageSource,
      "function getPlannedDurationValue",
      "const currentJobColumns:",
    );

    expect(pageSource).toContain("PressJobExpectedDurationUpdateRequest");
    expect(pageSource).toContain("updatePressJobExpectedDuration?: (");
    expect(plannedDurationSource).toContain("confirmPlannedDurationInput");
    expect(pageSource).toContain(
      "const expectedDuration = commitPlannedDurationInput(input.value)",
    );
    expect(plannedDurationSource).toContain(
      "value: getPlannedDurationValue(row)",
    );
    expect(plannedDurationSource).toContain("savePressJobExpectedDuration({");
    expect(pageSource).toContain("isValidExpectedDuration(expectedDuration)");
    expect(pageSource).toContain("input.row.pressJobId");
    expect(pageSource).toContain("input.updatePressJobExpectedDuration({");
    expect(pageSource).toContain("id: input.row.pressJobId");
    expect(plannedDurationSource).toContain('messageApi.success("预计时长保存成功")');
    expect(plannedDurationSource).toContain(
      'messageApi.info("预计时长将在开始加工时提交。")',
    );
    expect(pageSource).toContain("onConfirm={confirmPlannedDurationInput}");
  });

  /**
   * @brief 断言预计时长无效、保存失败、关闭草稿和重复确认均遵守最小安全边界。
   * @author PopoY
   */
  it("guards invalid, failed, cancelled and duplicate planned duration saves", () => {
    const plannedDurationSource = extractSourceBetween(
      pageSource,
      "function getPlannedDurationValue",
      "const currentJobColumns:",
    );

    expect(plannedDurationSource).toContain("plannedDurationSaveRequestRef");
    expect(plannedDurationSource).toContain("plannedDurationEditBaselineRef");
    expect(plannedDurationSource).toContain(
      "applyPlannedDurationSaveCompletion({",
    );
    expect(plannedDurationSource).toContain(
      'messageApi.warning("请输入正整数或一位小数的预计时长。")',
    );
    expect(pageSource).toContain("input.baseline");
    expect(plannedDurationSource).toContain(
      'messageApi.error("预计时长保存失败，请重试。")',
    );
    expect(plannedDurationSource).toContain(
      "discardPlannedDurationDraft(",
    );
    expect(pageSource).toContain("disabled={savingPlannedDurationRowId !== null}");
    expect(pageSource).toContain("onClose={closePlannedDurationKeypad}");
  });

  /**
   * @brief 通过 executable logic（可执行逻辑）验证预计时长成功、失败、仅本地、无效和请求中边界。
   * @author PopoY
   */
  it("executes planned duration save outcomes without duplicate ERP calls", async () => {
    const updatePressJobExpectedDuration = vi.fn(async () => {});
    const row = {
      localJobSessionId: "job-duration-01",
      plannedDurationHours: "1.5",
      pressJobId: 17,
    };

    await expect(
      savePressJobExpectedDuration({
        isSaving: false,
        row,
        updatePressJobExpectedDuration,
        value: "2.",
      }),
    ).resolves.toEqual({ expectedDuration: "2", status: "saved" });
    expect(updatePressJobExpectedDuration).toHaveBeenCalledWith({
      id: 17,
      expectedDuration: "2",
    });

    updatePressJobExpectedDuration.mockRejectedValueOnce(new Error("ERP failed"));
    await expect(
      savePressJobExpectedDuration({
        isSaving: false,
        row,
        updatePressJobExpectedDuration,
        value: "3.5",
      }),
    ).resolves.toEqual({ expectedDuration: "1.5", status: "failed" });

    updatePressJobExpectedDuration.mockClear();
    await expect(
      savePressJobExpectedDuration({
        isSaving: false,
        row: { ...row, pressJobId: undefined },
        updatePressJobExpectedDuration,
        value: ".5",
      }),
    ).resolves.toEqual({ expectedDuration: "0.5", status: "local" });
    await expect(
      savePressJobExpectedDuration({
        isSaving: false,
        row,
        updatePressJobExpectedDuration,
        value: "0",
      }),
    ).resolves.toEqual({ expectedDuration: "0", status: "invalid" });
    await expect(
      savePressJobExpectedDuration({
        isSaving: false,
        row,
        updatePressJobExpectedDuration,
        value: "-1",
      }),
    ).resolves.toEqual({ expectedDuration: "-1", status: "invalid" });
    await expect(
      savePressJobExpectedDuration({
        isSaving: true,
        row,
        updatePressJobExpectedDuration,
        value: "4",
      }),
    ).resolves.toEqual({ expectedDuration: "4", status: "pending" });
    expect(updatePressJobExpectedDuration).not.toHaveBeenCalled();
  });

  /**
   * @brief 断言失败与关闭恢复本次编辑捕获的 confirmed baseline（已确认基线），而非 ERP 初始值。
   * @author PopoY
   */
  it("restores the latest confirmed planned duration baseline", async () => {
    const row = {
      localJobSessionId: "job-duration-baseline",
      plannedDurationHours: "1",
      pressJobId: 18,
    };
    const updatePressJobExpectedDuration = vi
      .fn<(request: { id: number; expectedDuration: string }) => Promise<void>>()
      .mockResolvedValueOnce()
      .mockRejectedValueOnce(new Error("ERP failed"));

    const saved = await savePressJobExpectedDuration({
      baseline: { hadDraft: false, value: "1" },
      isSaving: false,
      row,
      updatePressJobExpectedDuration,
      value: "2",
    });
    expect(saved).toEqual({ expectedDuration: "2", status: "saved" });
    await expect(
      savePressJobExpectedDuration({
        baseline: { hadDraft: true, value: saved.expectedDuration },
        isSaving: false,
        row,
        updatePressJobExpectedDuration,
        value: "3",
      }),
    ).resolves.toEqual({ expectedDuration: "2", status: "failed" });

    const local = await savePressJobExpectedDuration({
      baseline: { hadDraft: false, value: "1" },
      isSaving: false,
      row: { ...row, pressJobId: undefined },
      updatePressJobExpectedDuration,
      value: "2.5",
    });
    expect(local).toEqual({ expectedDuration: "2.5", status: "local" });
    expect(
      discardPlannedDurationDraft(
        { [row.localJobSessionId]: "3" },
        row.localJobSessionId,
        null,
        { hadDraft: true, value: local.expectedDuration },
      ),
    ).toEqual({ [row.localJobSessionId]: "2.5" });
  });

  /**
   * @brief 断言 ERP 来源基线在关闭或失败时删除 draft（草稿），避免遮蔽后续 ERP 刷新值。
   * @author PopoY
   */
  it("drops ERP-sourced drafts so refreshed duration remains visible", async () => {
    const row = {
      localJobSessionId: "job-duration-erp-baseline",
      plannedDurationHours: "1",
      pressJobId: 19,
    };
    const baseline = { hadDraft: false, value: "1" };
    const draftBeforeClose = { [row.localJobSessionId]: "3" };
    const draftsAfterClose = discardPlannedDurationDraft(
      draftBeforeClose,
      row.localJobSessionId,
      null,
      baseline,
    );

    expect(draftsAfterClose).not.toHaveProperty(row.localJobSessionId);
    expect(draftsAfterClose[row.localJobSessionId] ?? "4").toBe("4");

    const failed = await savePressJobExpectedDuration({
      baseline,
      isSaving: false,
      row,
      updatePressJobExpectedDuration: vi.fn(async () => {
        throw new Error("ERP failed");
      }),
      value: "3",
    });
    const draftsAfterFailure = discardPlannedDurationDraft(
      { [row.localJobSessionId]: "3" },
      row.localJobSessionId,
      null,
      baseline,
    );

    expect(failed).toEqual({ expectedDuration: "1", status: "failed" });
    expect(draftsAfterFailure).not.toHaveProperty(row.localJobSessionId);
    expect(draftsAfterFailure[row.localJobSessionId] ?? "4").toBe("4");
  });

  /**
   * @brief 断言 ERP draft（草稿）按 pressJobId（压机作业 ID）稳定隔离，刷新后重新展示数据库值。
   * @author PopoY
   */
  it("keys ERP duration drafts by press job id and drops persisted values on refresh", () => {
    const originalRow = {
      localJobSessionId: "shared-row",
      plannedDurationHours: "1",
      pressJobId: 101,
    };
    const replacementRow = {
      localJobSessionId: "shared-row",
      plannedDurationHours: "4",
      pressJobId: 202,
    };
    const reorderedOriginalRow = {
      ...originalRow,
      localJobSessionId: "reordered-row",
    };
    const localRow = {
      localJobSessionId: "local-row",
      plannedDurationHours: "5",
    };

    expect(resolvePlannedDurationDraftKey(originalRow)).toBe(
      resolvePlannedDurationDraftKey(reorderedOriginalRow),
    );
    expect(resolvePlannedDurationDraftKey(originalRow)).not.toBe(
      resolvePlannedDurationDraftKey(replacementRow),
    );
    expect(resolvePlannedDurationDraftKey(localRow)).not.toBe(
      resolvePlannedDurationDraftKey(originalRow),
    );

    const erpDraftKey = resolvePlannedDurationDraftKey(originalRow);
    const localDraftKey = resolvePlannedDurationDraftKey(localRow);
    const draftsBeforeRefresh = {
      [erpDraftKey]: "2",
      [localDraftKey]: "6",
      "erp:303": "7",
    };
    const draftsAfterRefresh = dropPersistedPlannedDurationDrafts(
      draftsBeforeRefresh,
      new Set([erpDraftKey]),
    );

    expect(draftsAfterRefresh[erpDraftKey] ?? "3").toBe("3");
    expect(draftsAfterRefresh[localDraftKey]).toBe("6");
    expect(draftsAfterRefresh["erp:303"]).toBe("7");
    expect(draftsBeforeRefresh[erpDraftKey]).toBe("2");
  });

  /**
   * @brief 断言同一位置的新无 ID 作业不会命中上一条作业的预计时长草稿键。
   * @author PopoY
   */
  it("does not reuse a no-id duration draft when the current job is replaced", async () => {
    const getJson = vi
      .fn()
      .mockResolvedValueOnce({
        code: 200,
        data: [
          {
            deviceName: "一号压机",
            mouldCode: "MOLD-A",
            startTime: "2026-07-21 08:00:00",
            expectedDuration: "1",
            status: "1",
          },
        ],
      })
      .mockResolvedValueOnce({
        code: 200,
        data: [
          {
            deviceName: "二号压机",
            mouldCode: "MOLD-B",
            startTime: "2026-07-21 09:00:00",
            expectedDuration: "2",
            status: "0",
          },
        ],
      });
    const [firstJob] = await fetchPressJobCurrentJobs(getJson, {
      erpBaseUrl: "http://127.0.0.1:8080",
      sessionToken: "erp-session-token",
    });
    const [replacementJob] = await fetchPressJobCurrentJobs(getJson, {
      erpBaseUrl: "http://127.0.0.1:8080",
      sessionToken: "erp-session-token",
    });
    const firstDraftKey = resolvePlannedDurationDraftKey(firstJob);
    const replacementDraftKey = resolvePlannedDurationDraftKey(replacementJob);
    const drafts = { [firstDraftKey]: "9" };

    expect(replacementDraftKey).not.toBe(firstDraftKey);
    expect(drafts[replacementDraftKey]).toBeUndefined();
  });

  /**
   * @brief 断言 current jobs（当前作业）变化时清理已离场的无 ID 草稿，同时保留仍在场作业。
   * @author PopoY
   */
  it("drops orphaned no-id duration drafts across the full job lifecycle", () => {
    const noIdJobA = {
      localJobSessionId: "job-a",
      moldNo: "MOLD-A",
    };
    const noIdJobB = {
      localJobSessionId: "job-b",
      moldNo: "MOLD-B",
    };
    const erpJobA = {
      ...noIdJobA,
      localJobSessionId: "press-job-id-101",
      pressJobId: 101,
    };
    const jobADraftKey = resolvePlannedDurationDraftKey(noIdJobA);
    const jobBDraftKey = resolvePlannedDurationDraftKey(noIdJobB);
    const drafts = {
      [jobADraftKey]: "9",
      [jobBDraftKey]: "8",
    };

    expect(
      dropPersistedPlannedDurationDrafts(drafts, new Set(), [noIdJobA]),
    ).toEqual({ [jobADraftKey]: "9" });

    const draftsAfterJobAStarts = dropPersistedPlannedDurationDrafts(
      drafts,
      new Set(),
      [erpJobA],
    );
    expect(draftsAfterJobAStarts[jobADraftKey]).toBeUndefined();
    const laterSameJobADraftKey = resolvePlannedDurationDraftKey(noIdJobA);
    expect(draftsAfterJobAStarts[laterSameJobADraftKey]).toBeUndefined();

    expect(
      dropPersistedPlannedDurationDrafts(drafts, new Set(), [noIdJobB]),
    ).toEqual({ [jobBDraftKey]: "8" });

    const markerEffectsSource = extractSourceBetween(
      pageSource,
      "consumeArmedPersistedPlannedDurationDraftMarkers(",
      "点击 Unlock Drawer",
    );
    expect(markerEffectsSource).toContain(
      "dropPersistedPlannedDurationDrafts(\n        currentDrafts,\n        persistedDraftKeys,\n        currentJobRows",
    );
  });

  /**
   * @brief 断言当前作业 Table（表格）实际复用稳定的预计时长 draft key（草稿键）作为 React row key（行键）。
   * @author PopoY
   */
  it("uses stable planned duration draft keys for current job table rows", () => {
    const currentJobTableSource = extractSourceBetween(
      pageSource,
      "<Table<PressJobCurrentJobRow>",
      "/>",
    );

    expect(currentJobTableSource).toContain(
      "rowKey={resolvePlannedDurationDraftKey}",
    );
    expect(currentJobTableSource).not.toContain('rowKey="localJobSessionId"');
  });

  /**
   * @brief 断言旧 refresh effect（刷新副作用）不能消费保存后才登记的未激活 marker（标记）。
   * @author PopoY
   */
  it("arms persisted duration markers after queued refresh cleanup", () => {
    const persistedMarkers = new Map<string, boolean>();
    const draftKey = "erp:101";
    const queuedRefreshCleanup = () =>
      consumeArmedPersistedPlannedDurationDraftMarkers(persistedMarkers);

    // @author PopoY: refresh 已排队后保存才完成，旧 refresh 只能看到并跳过 unarmed marker（未激活标记）。
    persistedMarkers.set(draftKey, false);
    expect(queuedRefreshCleanup()).toEqual(new Set());
    expect(persistedMarkers.get(draftKey)).toBe(false);

    armPersistedPlannedDurationDraftMarkers(persistedMarkers);
    expect(persistedMarkers.get(draftKey)).toBe(true);
    expect(
      consumeArmedPersistedPlannedDurationDraftMarkers(persistedMarkers),
    ).toEqual(new Set([draftKey]));
    expect(persistedMarkers.has(draftKey)).toBe(false);

    const markerEffectsSource = extractSourceBetween(
      pageSource,
      "consumeArmedPersistedPlannedDurationDraftMarkers(",
      "点击 Unlock Drawer",
    );
    expect(
      markerEffectsSource.indexOf(
        "consumeArmedPersistedPlannedDurationDraftMarkers(",
      ),
    ).toBeLessThan(
      markerEffectsSource.indexOf("armPersistedPlannedDurationDraftMarkers("),
    );
  });

  /**
   * @brief 断言正常保存 commit（提交）先激活 marker，紧随其后的第一次真实刷新即可消费。
   * @author PopoY
   */
  it("consumes an armed persisted duration marker on the next refresh", () => {
    const draftKey = "erp:102";
    const persistedMarkers = new Map([[draftKey, false]]);

    armPersistedPlannedDurationDraftMarkers(persistedMarkers);

    expect(
      consumeArmedPersistedPlannedDurationDraftMarkers(persistedMarkers),
    ).toEqual(new Set([draftKey]));
  });

  /**
   * @brief 断言组件实际复用的 completion helper（完成辅助函数）执行 saving、draft、marker、keypad 和 feedback 决策。
   * @author PopoY
   */
  it("applies planned duration completion decisions to component state", () => {
    const runCompletion = (
      status: "failed" | "invalid" | "local" | "pending" | "saved" | "stale",
      baseline: {
        hadDraft: boolean;
        persistedMarkerArmed?: boolean;
        value: string;
      } = {
        hadDraft: true,
        persistedMarkerArmed: true,
        value: "1",
      },
    ) => {
      let drafts: Record<string, string> = {
        "erp:101": "3",
        "erp:202": "8",
      };
      const markers = new Map<string, boolean>();
      const finishKeypad = vi.fn();
      const feedback = vi.fn();
      const setSavingRowId = vi.fn();

      applyPlannedDurationSaveCompletion({
        baseline,
        draftMarkers: markers,
        finishKeypad,
        notify: feedback,
        requestRef: null,
        result: { expectedDuration: status === "invalid" ? "0" : "2", status },
        rowId: "erp:101",
        setDrafts: (updateDrafts) => {
          drafts = updateDrafts(drafts);
        },
        setSavingRowId,
      });

      return { drafts, feedback, finishKeypad, markers, setSavingRowId };
    };

    const stale = runCompletion("stale");
    expect(stale.setSavingRowId).toHaveBeenCalledWith(null);
    expect(stale.drafts).toEqual({ "erp:202": "8" });
    expect(stale.finishKeypad).toHaveBeenCalledOnce();
    expect(stale.feedback).not.toHaveBeenCalled();

    const invalid = runCompletion("invalid");
    expect(invalid.setSavingRowId).toHaveBeenCalledWith(null);
    expect(invalid.drafts["erp:101"]).toBe("0");
    expect(invalid.finishKeypad).not.toHaveBeenCalled();
    expect(invalid.markers.size).toBe(0);
    expect(invalid.feedback).toHaveBeenCalledWith("invalid");

    const saved = runCompletion("saved");
    expect(saved.drafts["erp:101"]).toBe("2");
    expect(saved.markers.get("erp:101")).toBe(false);
    expect(saved.finishKeypad).toHaveBeenCalledOnce();
    expect(saved.feedback).toHaveBeenCalledWith("saved");

    const failed = runCompletion("failed");
    expect(failed.drafts["erp:101"]).toBe("1");
    expect(failed.markers.get("erp:101")).toBe(true);
    expect(failed.finishKeypad).toHaveBeenCalledOnce();
    expect(failed.feedback).toHaveBeenCalledWith("failed");

    const failedUnarmed = runCompletion("failed", {
      hadDraft: true,
      persistedMarkerArmed: false,
      value: "1",
    });
    expect(failedUnarmed.markers.get("erp:101")).toBe(false);

    const failedWithoutMarker = runCompletion("failed", {
      hadDraft: false,
      value: "1",
    });
    expect(failedWithoutMarker.markers.size).toBe(0);

    const local = runCompletion("local");
    expect(local.drafts["erp:101"]).toBe("2");
    expect(local.feedback).toHaveBeenCalledWith("local");
    expect(local.finishKeypad).toHaveBeenCalledOnce();

    const pending = runCompletion("pending");
    expect(pending.setSavingRowId).not.toHaveBeenCalled();
    expect(pending.drafts["erp:101"]).toBe("3");
    expect(pending.feedback).not.toHaveBeenCalled();
    expect(pending.finishKeypad).not.toHaveBeenCalled();
  });

  /**
   * @brief 断言 deferred PUT（延迟更新）按 ERP 作业身份识别 stale completion（陈旧完成），而非数组位置。
   * @author PopoY
   */
  it("treats replacement jobs as stale while allowing the same ERP job to reorder", async () => {
    const replacedDeferred = createDeferred<void>();
    const replacedRequestRef = { current: null as object | null };
    const replacedRowsRef = {
      current: [
        {
          localJobSessionId: "shared-row",
          plannedDurationHours: "1",
          pressJobId: 101,
        },
      ],
    };
    const replacedSave = savePressJobExpectedDuration({
      baseline: { hadDraft: false, value: "1" },
      currentJobRowsRef: replacedRowsRef,
      isSaving: false,
      requestRef: replacedRequestRef,
      row: replacedRowsRef.current[0],
      updatePressJobExpectedDuration: () => replacedDeferred.promise,
      value: "2",
    });

    replacedRowsRef.current = [
      {
        localJobSessionId: "shared-row",
        plannedDurationHours: "8",
        pressJobId: 202,
      },
    ];
    replacedDeferred.resolve();

    await expect(replacedSave).resolves.toEqual({
      expectedDuration: "1",
      status: "stale",
    });
    expect(replacedRequestRef.current).toBeNull();

    const reorderedDeferred = createDeferred<void>();
    const reorderedRowsRef = {
      current: [
        {
          localJobSessionId: "row-101-before",
          plannedDurationHours: "1",
          pressJobId: 101,
        },
        {
          localJobSessionId: "row-202-before",
          plannedDurationHours: "8",
          pressJobId: 202,
        },
      ],
    };
    const reorderedSave = savePressJobExpectedDuration({
      baseline: { hadDraft: false, value: "1" },
      currentJobRowsRef: reorderedRowsRef,
      isSaving: false,
      row: reorderedRowsRef.current[0],
      updatePressJobExpectedDuration: () => reorderedDeferred.promise,
      value: "2",
    });

    reorderedRowsRef.current = [
      reorderedRowsRef.current[1],
      {
        ...reorderedRowsRef.current[0],
        localJobSessionId: "row-101-after",
      },
    ];
    reorderedDeferred.resolve();

    await expect(reorderedSave).resolves.toEqual({
      expectedDuration: "2",
      status: "saved",
    });
  });

  /**
   * @brief 断言同步 request ref（请求引用）阻止同一 render（渲染周期）的双确认和 A/B 行并发保存。
   * @author PopoY
   */
  it("guards duplicate and cross-row saves with one synchronous request ref", async () => {
    const deferred = createDeferred<void>();
    const requestRef = { current: null as object | null };
    const updatePressJobExpectedDuration = vi.fn(() => deferred.promise);
    const rowA = {
      localJobSessionId: "job-duration-a",
      plannedDurationHours: "1",
      pressJobId: 21,
    };
    const rowB = {
      localJobSessionId: "job-duration-b",
      plannedDurationHours: "4",
      pressJobId: 22,
    };

    const firstSave = savePressJobExpectedDuration({
      baseline: { hadDraft: false, value: "1" },
      isSaving: false,
      requestRef,
      row: rowA,
      updatePressJobExpectedDuration,
      value: "2",
    });
    const duplicateSave = savePressJobExpectedDuration({
      baseline: { hadDraft: false, value: "1" },
      isSaving: false,
      requestRef,
      row: rowA,
      updatePressJobExpectedDuration,
      value: "3",
    });
    const crossRowSave = savePressJobExpectedDuration({
      baseline: { hadDraft: false, value: "4" },
      isSaving: false,
      requestRef,
      row: rowB,
      updatePressJobExpectedDuration,
      value: "5",
    });
    const callCountBeforeCompletion = updatePressJobExpectedDuration.mock.calls.length;
    deferred.resolve();

    await expect(firstSave).resolves.toEqual({
      expectedDuration: "2",
      status: "saved",
    });
    await expect(duplicateSave).resolves.toEqual({
      expectedDuration: "3",
      status: "pending",
    });
    await expect(crossRowSave).resolves.toEqual({
      expectedDuration: "5",
      status: "pending",
    });
    expect(callCountBeforeCompletion).toBe(1);
    expect(updatePressJobExpectedDuration).toHaveBeenCalledWith({
      id: 21,
      expectedDuration: "2",
    });
    expect(requestRef.current).toBeNull();
  });

  /**
   * @brief 断言保存期间关闭不恢复草稿，陈旧完成也不清除后来请求的 identity（身份）。
   * @author PopoY
   */
  it("blocks close while saving and preserves a newer request identity", async () => {
    const deferred = createDeferred<void>();
    const requestRef = { current: null as object | null };
    const row = {
      localJobSessionId: "job-duration-stale",
      plannedDurationHours: "1",
      pressJobId: 23,
    };
    const save = savePressJobExpectedDuration({
      baseline: { hadDraft: false, value: "1" },
      isSaving: false,
      requestRef,
      row,
      updatePressJobExpectedDuration: () => deferred.promise,
      value: "2",
    });
    const claimedIdentity = requestRef.current;

    expect(
      discardPlannedDurationDraft(
        { [row.localJobSessionId]: "2" },
        row.localJobSessionId,
        requestRef,
        { hadDraft: false, value: "1" },
      ),
    ).toEqual({ [row.localJobSessionId]: "2" });

    const newerIdentity = {};
    requestRef.current = newerIdentity;
    deferred.resolve();

    expect(claimedIdentity).not.toBeNull();
    await expect(save).resolves.toEqual({
      expectedDuration: "1",
      status: "stale",
    });
    expect(requestRef.current).toBe(newerIdentity);
  });

  /**
   * @brief 通过 executable logic（可执行逻辑）验证点击关闭只丢弃目标行草稿且不修改原对象。
   * @author PopoY
   */
  it("discards only the active planned duration draft on close", () => {
    const drafts = { "job-01": "2.5", "job-02": "3" };

    expect(discardPlannedDurationDraft(drafts, "job-01")).toEqual({
      "job-02": "3",
    });
    expect(drafts).toEqual({ "job-01": "2.5", "job-02": "3" });
  });

  /**
   * @brief 断言班组变更会清空下级人员和预选工艺选择。
   * @author PopoY
   */
  it("clears operator and process when the selected team changes", () => {
    expect(createPressJobTeamChangeState("PLINE-B")).toEqual({
      teamId: "PLINE-B",
      operatorId: undefined,
      processId: undefined,
    });
    expect(createPressJobTeamChangeState()).toEqual({
      teamId: undefined,
      operatorId: undefined,
      processId: undefined,
    });
  });

  /**
   * @brief 断言 ERP（企业资源计划）没有默认班组/人员时不写入新 filters（筛选状态），避免 effect（副作用）循环 setState。
   * @author PopoY
   */
  it("skips default filter updates when lookup data has no default selections", () => {
    expect(
      resolvePressJobDefaultFilterState(
        {},
        {
          operatorOptions: [],
          processOptions: [],
          teamOptions: [],
        },
      ),
    ).toBeNull();
    expect(
      resolvePressJobDefaultFilterState(
        {},
        {
          defaultOperatorId: "zhangsan",
          defaultTeamId: "PLINE-A",
          operatorOptions: [],
          processOptions: [],
          teamOptions: [],
        },
      ),
    ).toEqual({
      operatorId: "zhangsan",
      teamId: "PLINE-A",
    });
  });

  /**
   * @brief 断言筛选 Select（选择器）只由本地 filters state（筛选状态）控制，避免 Form store（表单状态仓库）保留旧值。
   * @author PopoY
   */
  it("keeps filter selects out of the Form store so cascade clearing reaches the visible values", () => {
    expect(pageSource).not.toContain('name="teamId"');
    expect(pageSource).not.toContain('name="operatorId"');
    expect(pageSource).not.toContain('name="processId"');
  });

  /**
   * @brief 断言非默认班组 loading（加载）窗口不会回退展示默认班组下级选项。
   * @author PopoY
   */
  it("does not expose fallback operator or process options while a non-default team is loading", () => {
    const lookupData = {
      defaultOperatorId: "zhangsan",
      defaultTeamId: "PLINE-A",
      operatorOptions: [
        { operatorId: "zhangsan", operatorName: "张三", teamId: "PLINE-A" },
      ],
      processOptions: [
        { processId: "PRESS-A", processName: "默认工艺", teamId: "PLINE-A" },
      ],
      teamOptions: [
        { teamId: "PLINE-A", teamName: "压机一班" },
        { teamId: "PLINE-B", teamName: "压机二班" },
      ],
    };

    expect(resolveActivePressJobTeamOptions("PLINE-B", lookupData, null)).toEqual({
      operatorOptions: [],
      processOptions: [],
    });
    expect(
      resolveActivePressJobTeamOptions("PLINE-B", lookupData, {
        operatorOptions: [
          { operatorId: "lisi", operatorName: "李四", teamId: "PLINE-B" },
        ],
        processOptions: [
          { processId: "PRESS-B", processName: "二班工艺", teamId: "PLINE-B" },
        ],
        teamId: "PLINE-B",
      }),
    ).toEqual({
      operatorOptions: [
        { operatorId: "lisi", operatorName: "李四", teamId: "PLINE-B" },
      ],
      processOptions: [
        { processId: "PRESS-B", processName: "二班工艺", teamId: "PLINE-B" },
      ],
    });
  });

  /**
   * @brief 断言页面切换 remount（重新挂载）后会补载非默认班组的人员和预选工艺 options（选项）。
   * @author PopoY
   */
  it("reloads non-default team cascade options after persisted filters remount", () => {
    expect(
      shouldLoadPersistedPressJobTeamOptions("PLINE-B", "PLINE-A", null, null, true),
    ).toBe(true);
    expect(
      shouldLoadPersistedPressJobTeamOptions(
        "PLINE-B",
        "PLINE-A",
        {
          operatorOptions: [
            { operatorId: "lisi", operatorName: "李四", teamId: "PLINE-B" },
          ],
          processOptions: [
            { processId: "PRESS-B", processName: "二班工艺", teamId: "PLINE-B" },
          ],
          teamId: "PLINE-B",
        },
        null,
        true,
      ),
    ).toBe(false);
    expect(
      shouldLoadPersistedPressJobTeamOptions(
        "PLINE-B",
        "PLINE-A",
        null,
        "PLINE-B",
        true,
      ),
    ).toBe(false);
    expect(
      shouldLoadPersistedPressJobTeamOptions("PLINE-A", "PLINE-A", null, null, true),
    ).toBe(false);
    expect(pageSource).toContain("loadAndCachePressJobTeamOptions(filters.teamId)");
  });

  /**
   * @brief 断言 Press Device Action（压机设备动作）共享前置校验 fail closed（失败关闭）。
   * @author PopoY
   */
  it("validates shared press device action preflight before command calls", () => {
    const connectedDriverSession = createDriverSession("Connected");
    const currentJobs = [
      {
        localJobSessionId: "job-01",
        pressName: "一号压机",
        status: "0",
      },
    ];

    expect(
      validateSharedPressDeviceActionPreflight(
        "moveIn",
        { operatorId: "op-01", processId: "PRESS-01" },
        connectedDriverSession,
        currentJobs,
      ),
    ).toBe("请先选择班组。");
    expect(
      validateSharedPressDeviceActionPreflight(
        "moveIn",
        { teamId: "team-01", processId: "PRESS-01" },
        connectedDriverSession,
        currentJobs,
      ),
    ).toBe("请先选择人员。");
    expect(
      validateSharedPressDeviceActionPreflight(
        "moveIn",
        { teamId: "team-01", operatorId: "op-01" },
        connectedDriverSession,
        currentJobs,
      ),
    ).toBe("请先选择预选工艺。");
    expect(
      validateSharedPressDeviceActionPreflight(
        "moveIn",
        { teamId: "team-01", operatorId: "op-01", processId: "PRESS-01" },
        connectedDriverSession,
        [{ localJobSessionId: "job-01" }],
      ),
    ).toBe("当前作业状态未确认，请刷新后重试。");
    expect(
      validateSharedPressDeviceActionPreflight(
        "moveIn",
        { teamId: "team-01", operatorId: "op-01", processId: "PRESS-01" },
        createDriverSession("Disconnected"),
        currentJobs,
      ),
    ).toBe("设备授权未就绪，请稍后重试。");
    expect(
      validateSharedPressDeviceActionPreflight(
        "moveIn",
        { teamId: "team-01", operatorId: "op-01", processId: "PRESS-01" },
        connectedDriverSession,
        currentJobs,
      ),
    ).toBeNull();
    expect(readPrimaryCurrentJob(currentJobs)).toEqual(currentJobs[0]);
    expect(isCurrentJobStateKnown(currentJobs)).toBe(true);
    expect(isCurrentJobStateKnown([])).toBe(false);
  });

  /**
   * @brief 断言 Press Device Action identity（压机设备动作身份）只包含白名单字段。
   * @author PopoY
   */
  it("creates press device action identity without raw device fields", () => {
    const identity = createPressDeviceActionIdentity("moveIn", {
      localJobSessionId: "job-01",
      pressName: "一号压机",
      status: "0",
    });

    expect(identity).toMatchObject({
      buttonKey: "moveIn",
      commandName: "moveIn",
      localJobSessionId: "job-01",
    });
    expect(identity.correlationId).toContain("press-device-moveIn-");
    expect(identity.idempotencyKey).toBe(identity.correlationId);
    expect(Object.keys(identity).sort()).toEqual([
      "buttonKey",
      "commandName",
      "correlationId",
      "idempotencyKey",
      "localJobSessionId",
    ]);
  });

  /**
   * @brief 断言 simple device actions（简单设备动作）调用 Driver command（驱动命令）并刷新信号。
   * @author PopoY
   */
  it("executes connect and movement actions through injected callbacks", async () => {
    const executePressDeviceCommand = vi.fn().mockResolvedValue({
      correlationId: "press-connect-01",
      commandName: "connectMes",
      localJobSessionId: "job-01",
      idempotencyKey: "press-connect-01",
      resultCode: "PARTIAL_OK",
      completedSteps: ["MES通信状态"],
      failedSteps: ["附属步骤"],
    });
    const refreshSignalSnapshot = vi.fn().mockResolvedValue(undefined);

    await expect(
      executePressJobSimpleDeviceAction({
        buttonKey: "connect",
        currentJobRows: [{ localJobSessionId: "job-01", status: "0" }],
        driverSession: createDriverSession("Connected"),
        executePressDeviceCommand,
        filters: { teamId: "team-01", operatorId: "op-01", processId: "PRESS-01" },
        refreshSignalSnapshot,
      }),
    ).resolves.toMatchObject({
      feedbackMessage: "通信已建立，附属步骤需要关注，请查看诊断日志。",
      feedbackType: "warning",
      resultCode: "PARTIAL_OK",
    });

    expect(executePressDeviceCommand).toHaveBeenCalledWith(
      expect.objectContaining({ commandName: "connectMes", timeoutMs: 5000 }),
    );
    expect(refreshSignalSnapshot).toHaveBeenCalledTimes(1);
  });

  /**
   * @brief 断言 simple device action（简单设备动作）在 Driver preflight（驱动前置校验）失败时不下发写入命令。
   * @author PopoY
   */
  it("blocks simple device action when driver precheck rejects signal write permission", async () => {
    const precheckPressDeviceCommand = vi.fn().mockResolvedValue({
      correlationId: "press-move-in-01",
      commandName: "moveIn",
      localJobSessionId: "job-01",
      idempotencyKey: "press-move-in-01",
      resultCode: "SIGNAL_NOT_WRITABLE",
      message: "信号不可写。",
      completedSteps: [],
      failedSteps: ["允许移入"],
    });
    const executePressDeviceCommand = vi.fn();
    const updatePressMachineStatus = vi.fn();

    await expect(
      executePressJobSimpleDeviceAction({
        buttonKey: "moveIn",
        currentJobRows: [{ localJobSessionId: "job-01", status: "0" }],
        driverSession: createDriverSession("Connected"),
        executePressDeviceCommand,
        filters: { teamId: "team-01", operatorId: "op-01", processId: "PRESS-01" },
        precheckPressDeviceCommand,
        updatePressMachineStatus,
      }),
    ).resolves.toMatchObject({
      feedbackMessage: "当前设备命令没有写权限，请刷新授权后重试。",
      feedbackType: "warning",
      resultCode: "PREFLIGHT_FAILED",
    });

    expect(precheckPressDeviceCommand).toHaveBeenCalledWith(
      expect.objectContaining({ commandName: "moveIn", timeoutMs: 5000 }),
    );
    expect(executePressDeviceCommand).not.toHaveBeenCalled();
    expect(updatePressMachineStatus).not.toHaveBeenCalled();
  });

  /**
   * @brief 断言 Line In/Out（入线/出线）复用同一个 correlationId（关联 ID）并处理 partial success（部分成功）。
   * @author PopoY
   */
  it("runs line actions with shared correlation id across driver and ERP", async () => {
    const executePressDeviceCommand = vi.fn().mockResolvedValue({
      correlationId: "driver-response-cid",
      commandName: "lineIn",
      localJobSessionId: "job-01",
      idempotencyKey: "driver-response-cid",
      resultCode: "OK",
      completedSteps: ["lineIn"],
      failedSteps: [],
    });
    const updatePressMachineStatus = vi
      .fn()
      .mockRejectedValue(new Error("HTTP 500"));
    const refreshSignalSnapshot = vi.fn().mockResolvedValue(undefined);
    const refreshPressJobCurrentJobs = vi.fn().mockResolvedValue([]);

    await expect(
      executePressJobSimpleDeviceAction({
        buttonKey: "lineIn",
        currentJobRows: [{ localJobSessionId: "job-01", status: "0" }],
        driverSession: createDriverSession("Connected"),
        executePressDeviceCommand,
        filters: { teamId: "team-01", operatorId: "op-01", processId: "PRESS-01" },
        refreshPressJobCurrentJobs,
        refreshSignalSnapshot,
        updatePressMachineStatus,
      }),
    ).resolves.toMatchObject({
      feedbackMessage: "部分动作完成，请查看诊断日志。",
      feedbackType: "warning",
      resultCode: "PARTIAL_OK",
    });

    const driverRequest = executePressDeviceCommand.mock.calls[0][0];
    const erpRequest = updatePressMachineStatus.mock.calls[0][0];

    expect(driverRequest.commandName).toBe("lineIn");
    expect(erpRequest).toMatchObject({
      correlationId: driverRequest.correlationId,
      idempotencyKey: driverRequest.idempotencyKey,
      localJobSessionId: "job-01",
      reason: "lineIn",
      status: "0",
    });
    expect(refreshSignalSnapshot).toHaveBeenCalledTimes(1);
    expect(refreshPressJobCurrentJobs).not.toHaveBeenCalled();
  });

  /**
   * @brief 断言 Task6（任务六）开始/完工前置校验 fail closed（失败关闭）。
   * @author PopoY
   */
  it("validates start and complete workflow preflights", () => {
    const filters = { teamId: "team-01", operatorId: "op-01", processId: "PRESS-01" };
    const pendingJob = {
      localJobSessionId: "job-01",
      moldNo: "MOLD-01",
      status: "0",
    };
    const runningJob = {
      localJobSessionId: "job-02",
      moldNo: "MOLD-02",
      status: "1",
    };

    expect(
      validateStartPressJobPreflight({
        currentJobRows: [runningJob],
        driverSession: createDriverSession("Connected"),
        expectedDuration: "1",
        filters,
      }),
    ).toBe("只有待加工作业可以开始加工。");
    expect(
      validateStartPressJobPreflight({
        currentJobRows: [{ ...pendingJob, moldNo: "" }],
        driverSession: createDriverSession("Connected"),
        expectedDuration: "1",
        filters,
      }),
    ).toBe("开始加工前请先锁定模具。");
    expect(
      validateStartPressJobPreflight({
        currentJobRows: [pendingJob],
        driverSession: createDriverSession("Connected"),
        expectedDuration: "1.25",
        filters,
      }),
    ).toBe("预计时长必须为正整数或一位小数。");
    expect(
      validateStartPressJobPreflight({
        currentJobRows: [pendingJob],
        driverSession: createDriverSession("CleanupPending"),
        expectedDuration: "1.5",
        filters,
      }),
    ).toBe("设备仍处于清理待完成状态，请处理后再开始加工。");
    expect(
      validateStartPressJobPreflight({
        currentJobRows: [pendingJob],
        driverSession: createDriverSession("Connected"),
        expectedDuration: "1.5",
        filters,
      }),
    ).toBeNull();
    expect(
      validateCompletePressJobPreflight({
        currentJobRows: [pendingJob],
        driverSession: createDriverSession("Connected"),
        filters,
      }),
    ).toBe("只有加工中作业可以完成加工。");
    expect(
      validateCompletePressJobPreflight({
        currentJobRows: [{ ...runningJob, localJobSessionId: "" }],
        driverSession: createDriverSession("Connected"),
        filters,
      }),
    ).toBe("当前作业缺少本地会话 ID，请刷新后重试。");
    expect(
      validateCompletePressJobPreflight({
        currentJobRows: [runningJob],
        driverSession: createDriverSession("Connected"),
        filters,
      }),
    ).toBeNull();
  });

  /**
   * @brief 断言 Task6（任务六）请求构造只保留 ERP/Driver whitelist（白名单）字段。
   * @author PopoY
   */
  it("builds start, complete, and parameter requests without raw device fields", () => {
    const identity = {
      buttonKey: "startProcessing" as const,
      commandName: "startDeviceSession" as const,
      correlationId: "press-start-01",
      idempotencyKey: "press-start-01",
      localJobSessionId: "job-01",
    };
    const filters = { teamId: "team-01", operatorId: "op-01", processId: "PRESS-01" };

    expect(buildPressJobStartRequest(identity, filters, "1.5")).toEqual({
      correlationId: "press-start-01",
      idempotencyKey: "press-start-01",
      localJobSessionId: "job-01",
      operatorId: "op-01",
      teamId: "team-01",
      processId: "PRESS-01",
      expectedDuration: "1.5",
    });
    expect(buildPressJobCompleteRequest(identity, filters)).toEqual({
      correlationId: "press-start-01",
      idempotencyKey: "press-start-01",
      localJobSessionId: "job-01",
      operatorId: "op-01",
      status: "3",
    });
    expect(
      buildPressJobParameterRequest(identity, "end", {
        safeSignal: 7,
        deviceId: "drop-device",
      }),
    ).toEqual({
      correlationId: "press-start-01",
      idempotencyKey: "press-start-01",
      parameterIdempotencyKey: "press-start-01-param-end",
      localJobSessionId: "job-01",
      type: "end",
      signalValues: { safeSignal: 7 },
    });
  });

  /**
   * @brief 断言开始加工 workflow（流程）按 Driver -> ERP -> monitor（监测）顺序执行并支持回滚。
   * @author PopoY
   */
  it("runs start workflow in order and rolls back only ERP start failure", async () => {
    const calls: string[] = [];
    const executePressDeviceCommand = vi.fn(async (request) => {
      calls.push(request.commandName);
      return {
        ...request,
        resultCode: "OK",
        completedSteps: [],
        failedSteps: [],
      };
    });
    const startPressJob = vi.fn(async (request) => {
      calls.push("erpStart");
      return {
        correlationId: request.correlationId,
        localJobSessionId: request.localJobSessionId,
        resultCode: "OK",
      };
    });

    await expect(
      executePressJobStartWorkflow({
        currentJobRows: [
          {
            localJobSessionId: "job-01",
            moldNo: "MOLD-01",
            needParameterRecords: true,
            status: "0",
          },
        ],
        driverSession: createDriverSession("Connected"),
        executePressDeviceCommand,
        expectedDuration: "1.5",
        filters: { teamId: "team-01", operatorId: "op-01", processId: "PRESS-01" },
        refreshPressJobCurrentJobs: vi.fn().mockResolvedValue([]),
        refreshSignalSnapshot: vi.fn().mockResolvedValue(undefined),
        startPressJob,
      }),
    ).resolves.toMatchObject({ feedbackType: "success", resultCode: "OK" });
    expect(calls).toEqual([
      "precheckForStart",
      "startDeviceSession",
      "erpStart",
      "startPressDownCountMonitor",
    ]);

    calls.length = 0;
    await expect(
      executePressJobStartWorkflow({
        currentJobRows: [
          { localJobSessionId: "job-01", moldNo: "MOLD-01", status: "0" },
        ],
        driverSession: createDriverSession("Connected"),
        executePressDeviceCommand,
        expectedDuration: "1",
        filters: { teamId: "team-01", operatorId: "op-01", processId: "PRESS-01" },
        startPressJob: vi.fn(async () => {
          calls.push("erpStart");
          throw new Error("开始落库失败。");
        }),
      }),
    ).resolves.toMatchObject({ feedbackType: "error", resultCode: "ERP_START_FAILED" });
    expect(calls).toEqual(["precheckForStart", "startDeviceSession", "erpStart", "rollbackStartSignal"]);

    calls.length = 0;
    await expect(
      executePressJobStartWorkflow({
        currentJobRows: [
          {
            localJobSessionId: "job-01",
            moldNo: "MOLD-01",
            needParameterRecords: true,
            status: "0",
          },
        ],
        driverSession: createDriverSession("Connected"),
        executePressDeviceCommand: vi.fn(async (request) => {
          calls.push(request.commandName);
          if (request.commandName === "startPressDownCountMonitor") {
            throw new Error("monitor failed");
          }
          return { ...request, resultCode: "OK", completedSteps: [], failedSteps: [] };
        }),
        expectedDuration: "1",
        filters: { teamId: "team-01", operatorId: "op-01", processId: "PRESS-01" },
        startPressJob,
      }),
    ).resolves.toMatchObject({
      feedbackMessage: "开始加工已完成，开始参数监听未启动，请查看诊断日志。",
      feedbackType: "warning",
      resultCode: "MONITOR_START_FAILED",
    });
    expect(calls).not.toContain("rollbackStartSignal");
  });

  /**
   * @brief 断言开始加工 workflow（流程）在 Driver preflight（驱动前置校验）失败时不执行设备启动或 ERP start（开始落库）。
   * @author PopoY
   */
  it("blocks start workflow before driver and ERP calls when driver precheck fails", async () => {
    const precheckPressDeviceCommand = vi.fn(async (request) => ({
      ...request,
      resultCode: "SIGNAL_NOT_WRITABLE",
      message: "信号不可写。",
      completedSteps: [],
      failedSteps: ["下压计数清零"],
    }));
    const executePressDeviceCommand = vi.fn();
    const startPressJob = vi.fn();

    await expect(
      executePressJobStartWorkflow({
        currentJobRows: [
          { localJobSessionId: "job-01", moldNo: "MOLD-01", status: "0" },
        ],
        driverSession: createDriverSession("Connected"),
        executePressDeviceCommand,
        expectedDuration: "1",
        filters: { teamId: "team-01", operatorId: "op-01", processId: "PRESS-01" },
        precheckPressDeviceCommand,
        startPressJob,
      }),
    ).resolves.toMatchObject({
      feedbackMessage: "当前设备命令没有写权限，请刷新授权后重试。",
      feedbackType: "warning",
      resultCode: "PREFLIGHT_FAILED",
    });

    expect(precheckPressDeviceCommand).toHaveBeenCalledWith(
      expect.objectContaining({ commandName: "startDeviceSession" }),
    );
    expect(executePressDeviceCommand).not.toHaveBeenCalled();
    expect(startPressJob).not.toHaveBeenCalled();
  });

  /**
   * @brief 断言完成加工 workflow（流程）在参数和 ERP 成功后才 cleanup（收尾）。
   * @author PopoY
   */
  it("runs complete workflow and blocks cleanup on parameter or ERP failure", async () => {
    const createInput = () => ({
      currentJobRows: [
        {
          localJobSessionId: "job-01",
          moldNo: "MOLD-01",
          status: "1",
        },
      ],
      driverSession: createDriverSession("Connected"),
      executePressDeviceCommand: vi.fn(async (request) => ({
        ...request,
        resultCode: "OK",
        completedSteps: [],
        failedSteps: [],
      })),
      filters: { teamId: "team-01", operatorId: "op-01", processId: "PRESS-01" },
      getFinalSignalSnapshot: vi.fn(async () => ({ pressDownCount: 8 })),
      recordPressJobParameters: vi.fn(async (request) => ({
        correlationId: request.correlationId,
        localJobSessionId: request.localJobSessionId,
        resultCode: "OK",
      })),
      completePressJob: vi.fn(async (request) => ({
        correlationId: request.correlationId,
        localJobSessionId: request.localJobSessionId,
        resultCode: "OK",
      })),
    });
    const input = createInput();

    await expect(runCompletePressJobWorkflow(input)).resolves.toMatchObject({
      feedbackType: "success",
      resultCode: "OK",
    });
    expect(input.getFinalSignalSnapshot).toHaveBeenCalledTimes(1);
    expect(input.recordPressJobParameters).toHaveBeenCalledWith(
      expect.objectContaining({ type: "end", signalValues: { pressDownCount: 8 } }),
    );
    expect(input.completePressJob).toHaveBeenCalledTimes(1);
    expect(input.executePressDeviceCommand).toHaveBeenCalledWith(
      expect.objectContaining({ commandName: "cleanupDeviceSession" }),
    );

    const parameterFailInput = createInput();
    parameterFailInput.recordPressJobParameters.mockRejectedValueOnce(
      new Error("参数失败"),
    );
    await expect(runCompletePressJobWorkflow(parameterFailInput)).resolves.toMatchObject({
      feedbackType: "error",
      resultCode: "PARAMETER_RECORD_FAILED",
    });
    expect(parameterFailInput.completePressJob).not.toHaveBeenCalled();
    expect(parameterFailInput.executePressDeviceCommand).not.toHaveBeenCalled();

    const erpFailInput = createInput();
    erpFailInput.completePressJob.mockRejectedValueOnce(new Error("完工失败"));
    await expect(runCompletePressJobWorkflow(erpFailInput)).resolves.toMatchObject({
      feedbackType: "error",
      resultCode: "ERP_COMPLETE_FAILED",
    });
    expect(erpFailInput.executePressDeviceCommand).not.toHaveBeenCalled();

    const cleanupFailInput = createInput();
    cleanupFailInput.executePressDeviceCommand.mockRejectedValueOnce(
      new Error("cleanup failed"),
    );
    await expect(runCompletePressJobWorkflow(cleanupFailInput)).resolves.toMatchObject({
      feedbackMessage: "完成加工已落库，设备收尾失败，请查看诊断日志并处理。",
      feedbackType: "warning",
      resultCode: "CLEANUP_PENDING",
    });
  });

  /**
   * @brief 断言完成加工 workflow（流程）在 cleanup preflight（收尾前置校验）失败时阻止快照、参数和 ERP 完工。
   * @author PopoY
   */
  it("blocks complete workflow before snapshot and ERP calls when cleanup precheck fails", async () => {
    const precheckPressDeviceCommand = vi.fn(async (request) => ({
      ...request,
      resultCode: "SIGNAL_NOT_WRITABLE",
      message: "信号不可写。",
      completedSteps: [],
      failedSteps: ["MES通信状态"],
    }));
    const input = {
      currentJobRows: [
        { localJobSessionId: "job-01", moldNo: "MOLD-01", status: "1" },
      ],
      driverSession: createDriverSession("Connected"),
      executePressDeviceCommand: vi.fn(),
      filters: { teamId: "team-01", operatorId: "op-01", processId: "PRESS-01" },
      getFinalSignalSnapshot: vi.fn(),
      precheckPressDeviceCommand,
      recordPressJobParameters: vi.fn(),
      completePressJob: vi.fn(),
    };

    await expect(runCompletePressJobWorkflow(input)).resolves.toMatchObject({
      feedbackMessage: "当前设备命令没有写权限，请刷新授权后重试。",
      feedbackType: "warning",
      resultCode: "PREFLIGHT_FAILED",
    });

    expect(precheckPressDeviceCommand).toHaveBeenCalledWith(
      expect.objectContaining({ commandName: "cleanupDeviceSession" }),
    );
    expect(input.getFinalSignalSnapshot).not.toHaveBeenCalled();
    expect(input.recordPressJobParameters).not.toHaveBeenCalled();
    expect(input.completePressJob).not.toHaveBeenCalled();
    expect(input.executePressDeviceCommand).not.toHaveBeenCalled();
  });

  /**
   * @brief 断言加工中出线会先校验 lineOut（出线）写权限，再弹自动完工确认框。
   * @author PopoY
   */
  it("blocks running line out before confirmation when line out precheck fails", async () => {
    const confirm = vi.fn().mockResolvedValue(true);
    const precheckPressDeviceCommand = vi.fn(async (request) => ({
      ...request,
      resultCode: "COMMAND_NOT_ALLOWED",
      message: "命令不在租约授权范围内。",
      completedSteps: [],
      failedSteps: ["lineOut"],
    }));
    const executePressDeviceCommand = vi.fn();

    await expect(
      executePressJobLineOutWorkflow({
        confirm,
        currentJobRows: [
          { localJobSessionId: "job-01", moldNo: "MOLD-01", status: "1" },
        ],
        driverSession: createDriverSession("Connected"),
        executePressDeviceCommand,
        filters: { teamId: "team-01", operatorId: "op-01", processId: "PRESS-01" },
        precheckPressDeviceCommand,
      }),
    ).resolves.toMatchObject({
      feedbackMessage: "当前设备命令未在租约授权范围内，请刷新授权后重试。",
      feedbackType: "warning",
      resultCode: "PREFLIGHT_FAILED",
    });

    expect(precheckPressDeviceCommand).toHaveBeenCalledWith(
      expect.objectContaining({ commandName: "lineOut" }),
    );
    expect(confirm).not.toHaveBeenCalled();
    expect(executePressDeviceCommand).not.toHaveBeenCalled();
  });

  /**
   * @brief 断言加工中出线和换模移出复用 completion workflow（完工流程）。
   * @author PopoY
   */
  it("reuses complete workflow before running line out or change-mold move out", async () => {
    const calls: string[] = [];
    const baseInput = {
      currentJobRows: [
        { localJobSessionId: "job-01", moldNo: "MOLD-01", status: "1" },
      ],
      driverSession: createDriverSession("Connected"),
      executePressDeviceCommand: vi.fn(async (request) => {
        calls.push(request.commandName);
        return { ...request, resultCode: "OK", completedSteps: [], failedSteps: [] };
      }),
      filters: { teamId: "team-01", operatorId: "op-01", processId: "PRESS-01" },
      getFinalSignalSnapshot: vi.fn(async () => ({ pressDownCount: 9 })),
      recordPressJobParameters: vi.fn(async (request) => {
        calls.push(`param-${request.type}`);
        return {
          correlationId: request.correlationId,
          localJobSessionId: request.localJobSessionId,
          resultCode: "OK",
        };
      }),
      completePressJob: vi.fn(async (request) => {
        calls.push("erpComplete");
        return {
          correlationId: request.correlationId,
          localJobSessionId: request.localJobSessionId,
          resultCode: "OK",
        };
      }),
      refreshPressJobCurrentJobs: vi.fn().mockResolvedValue([]),
      refreshSignalSnapshot: vi.fn().mockResolvedValue(undefined),
      updatePressMachineStatus: vi.fn(async (request) => {
        calls.push(`erpStatus-${request.status}`);
        return {
          correlationId: request.correlationId,
          localJobSessionId: request.localJobSessionId,
          resultCode: "OK",
          status: request.status,
        };
      }),
    };

    await expect(
      executePressJobLineOutWorkflow({
        ...baseInput,
        confirm: vi.fn().mockResolvedValue(true),
      }),
    ).resolves.toMatchObject({ feedbackType: "success", resultCode: "OK" });
    expect(calls).toEqual([
      "param-end",
      "erpComplete",
      "cleanupDeviceSession",
      "lineOut",
      "erpStatus-9",
    ]);

    calls.length = 0;
    await expect(
      executePressJobLineOutWorkflow({
        ...baseInput,
        confirm: vi.fn().mockResolvedValue(false),
      }),
    ).resolves.toMatchObject({ feedbackType: "warning", resultCode: "CANCELED" });
    expect(calls).toEqual([]);

    calls.length = 0;
    await expect(
      executePressJobMoveOutWorkflow({
        ...baseInput,
        changeMold: true,
        confirm: vi.fn().mockResolvedValue(true),
      }),
    ).resolves.toMatchObject({ feedbackType: "success", resultCode: "OK" });
    expect(calls).toEqual([
      "param-end",
      "erpComplete",
      "cleanupDeviceSession",
      "moveOut",
    ]);
  });

  /**
   * @brief 断言非加工中出线也必须保留 shared preflight（通用前置校验），避免 Task5（任务五）回归。
   * @author PopoY
   */
  it("keeps shared preflight for non-running line out workflow", async () => {
    const executePressDeviceCommand = vi.fn();
    const updatePressMachineStatus = vi.fn();

    await expect(
      executePressJobLineOutWorkflow({
        currentJobRows: [{ localJobSessionId: "job-01", moldNo: "MOLD-01", status: "0" }],
        driverSession: createDriverSession("Connected"),
        executePressDeviceCommand,
        filters: { teamId: "team-01", operatorId: "op-01" },
        updatePressMachineStatus,
      }),
    ).resolves.toMatchObject({
      feedbackMessage: "请先选择预选工艺。",
      feedbackType: "warning",
      resultCode: "PREFLIGHT_FAILED",
    });
    expect(executePressDeviceCommand).not.toHaveBeenCalled();
    expect(updatePressMachineStatus).not.toHaveBeenCalled();
  });

  /**
   * @brief 断言前端源码没有为 pressDownCount（下压计数）引入轮询或动画帧。
   * @author PopoY
   */
  it("does not poll pressDownCount from the frontend source", () => {
    const pressDownCountSource = extractSourceBetween(
      pageSource,
      "pressDownCount",
      "formatPressJobStatusText",
    );

    expect(pressDownCountSource).not.toContain("setInterval");
    expect(pressDownCountSource).not.toContain("requestAnimationFrame");
  });

  /**
   * @brief 断言 PressJobPage（压机作业页）不接收完整 bootstrap session（启动会话）敏感属性。
   * @author PopoY
   */
  it("accepts only sanitized bootstrap data instead of the full bootstrap session", () => {
    const propsSource = extractSourceBetween(
      pageSource,
      "export type PressJobPageProps",
      "export type PressJobFilterState",
    );

    expect(pageSource).toContain("type PressJobPageBootstrapSession");
    expect(propsSource).not.toContain("bootstrapSession?: UseBootstrapSessionResult");
    expect(propsSource).not.toContain("signedLease");
    expect(propsSource).not.toContain("signalConfig");
    expect(propsSource).not.toContain("sessionToken");
  });

  /**
   * @brief 断言页面渲染 spec（规格）要求的四行区域和空数据状态。
   * @author PopoY
   */
  it("renders the four frontend-only rows without mock data", () => {
    const html = renderPage();

    expect(html).toContain("press-job-page");
    expect(html).toContain("aria-label=\"压机作业筛选区\"");
    expect(html).toContain("ant-form-horizontal");
    expect(html).not.toContain("ant-form-vertical");
    expect(html).toContain("班组");
    expect(html).toContain("人员");
    expect(html).toContain("预选工艺");
    expect(html).toContain("请选择班组");
    expect(html).toContain("请选择人员");
    expect(html).toContain("请选择预选工艺");

    expect(html).toContain("aria-label=\"压机作业操作区\"");
    expect(html).toContain("建立通信");
    expect(html).toContain("锁定模具");
    expect(html).toContain("开始加工");
    expect(html).toContain("完成加工");
    expect(html).toContain("移入");
    expect(html).toContain("移出");
    expect(html).toContain("入线");
    expect(html).toContain("出线");
    expect(html.match(/press-job-page__action-icon/g)?.length ?? 0).toBe(8);
    expect(html).toContain("当前状态：");
    expect(html).toContain("未知");

    expect(html).toContain("aria-label=\"当前作业信息\"");
    expect(html).toContain("压机");
    expect(html).toContain("模具号");
    expect(html).toContain("预计时长(小时)");
    expect(html).toContain("实际时长(小时)");
    expect(html).toContain("开始时间");
    expect(html).toContain("当前状态");
    expect(html).toContain("暂无当前作业");

    expect(html).toContain("aria-label=\"实时信号\"");
    expect(html).toContain("暂无信号快照数据。");
    expect(pageSource).toContain("const PRESS_JOB_MAX_SIGNALS_PER_ROW = 7");
    expect(pageSource).toContain("maxSignalsPerRow={PRESS_JOB_MAX_SIGNALS_PER_ROW}");
    expect(html).not.toContain("示例");
    expect(html).not.toContain("mock");
  });

  /**
   * @brief 断言动作按钮使用 outlined variant（描边变体）表达颜色，并切换方向类 icon（图标）。
   * @author PopoY
   */
  it("uses colored outlined action buttons and directional icons", () => {
    const html = renderPage();

    expect(pageSource).toContain('variant?: ButtonProps["variant"]');
    expect(pageSource).toContain('color={actionButton.color}');
    expect(pageSource).toContain('variant={actionButton.variant}');
    expect(pageSource.match(/variant: "outlined"/g)?.length ?? 0).toBe(7);
    expect(pageSource).toContain('label: "锁定模具", color: "primary"');
    expect(pageSource).toContain('label: "开始加工", color: "primary"');
    expect(pageSource).toContain('label: "完成加工", color: "green"');
    expect(pageSource).toContain('label: "移入", color: "primary", iconSymbol: "→"');
    expect(pageSource).toContain('label: "移出", color: "primary", iconSymbol: "←"');
    expect(pageSource).toContain('label: "入线", color: "green", iconSymbol: "↓"');
    expect(pageSource).toContain('label: "出线", color: "danger", iconSymbol: "↑"');
    expect(html).toContain("press-job-page__action-button--lineOut");
    expect(pageSource).not.toContain("isLineOutClickAnimating");
    expect(pageSource).not.toContain("press-job-page__action-button--clicking");
    expect(pageCss).not.toContain("@keyframes pressJobLineOutButtonClick");
    expect(pageCss).not.toContain("@keyframes pressJobLineOutIconClick");
    expect(pageCss).not.toContain(".press-job-page__action-button--lineOut:is(:hover");
  });

  /**
   * @brief 断言页面只读取已有 signal snapshot（信号快照），不展示 bootstrap（启动）敏感字段。
   * @author PopoY
   */
  it("does not render sensitive bootstrap or device endpoint fields", () => {
    const html = renderPage(
      <PressJobPage
        bootstrapSession={{
          status: "success",
          config: null,
          data: {
            stationContext: {
              stationAccountId: "station-account-01",
              stationId: "station-01",
            },
            parameterGroupOptions: [
              { dictValue: "4", dictLabel: "压机动作参数" },
            ],
          },
          error: null,
          retry: async () => {},
        }}
        driverSession={{
          status: "success",
          data: {
            applyResult: null,
            signalSnapshot: {
              correlationId: "cid-snapshot-01",
              resultCode: "OK",
              signalValues: null as unknown as Record<string, unknown>,
            },
          },
          error: null,
          retry: async () => {},
          refreshSnapshot: async () => {},
        }}
      />,
    );

    expect(html).not.toContain("secret-session-token");
    expect(html).not.toContain("lease-secret-01");
    expect(html).not.toContain("secret-signature");
    expect(html).not.toContain("private-key-secret");
    expect(html).not.toContain("credential-secret");
    expect(html).not.toContain("raw-device-01");
    expect(html).not.toContain("signedLease");
    expect(html).not.toContain("sessionToken");
    expect(html).not.toContain("signalConfig");
    expect(html).not.toContain("privateKey");
    expect(html).not.toContain("credential");
  });

  /**
   * @brief 断言 action handlers（操作处理函数）使用注入回调，不直接导入客户端。
   * @author PopoY
   */
  it("keeps action handlers injected while allowing lock feedback", () => {
    expect(pageSource).toContain("handleConnect");
    expect(pageSource).toContain("handleLockMold");
    expect(pageSource).toContain("handleStartProcessing");
    expect(pageSource).toContain("handleCompleteProcessing");
    expect(pageSource).toContain("handleMoveIn");
    expect(pageSource).toContain("handleMoveOut");
    expect(pageSource).toContain("handleLineIn");
    expect(pageSource).toContain("handleLineOut");
    expect(pageSource).not.toContain("fetch(");
    expect(pageSource).not.toContain("driverClient");
    expect(pageSource).not.toContain("erpClient");
    expect(pageSource).not.toContain("localStorage");
    expect(pageSource).toContain("executePressDeviceCommand");
    expect(pageSource).toContain("updatePressMachineStatus");
    expect(pageSource).toContain("refreshSignalSnapshot");
    expect(pageSource).toContain("recordPressDeviceActionDiagnostic");
    expect(pageSource).toContain("messageApi.");
    expect(pageSource).toContain("modal.confirm");
    expect(pageSource).toContain("submitPressMoldLockWithRefresh");
    expect(pageSource).toContain("input.lockPressMold(input.request)");
    expect(pageSource).toContain("input.refreshPressJobCurrentJobs?.()");
    expect(pageSource).toContain("recordPressMoldLockDiagnostic?.(");
    expect(pageSource).not.toContain("notification.");
    expect(pageSource).not.toContain("logDiagnostic");
  });

  /**
   * @brief 断言 1280x720 touch IPC（触控工控机）样式保持固定外层和局部滚动。
   * @author PopoY
   */
  it("keeps the 1280x720 page shell compact and touch-ready", () => {
    expect(pageCss).toContain(".press-job-page");
    expect(pageCss).toContain("height: 100%");
    expect(pageCss).toContain("overflow: hidden");
    expect(pageCss).toContain("grid-template-rows: 62px 56px 138px minmax(0, 1fr)");
    expect(pageCss).toContain(".press-job-page__filters .ant-form-item-row");
    expect(pageCss).toContain(".press-job-page__actions .ant-btn");
    expect(pageCss).toContain("min-height: 44px");
    expect(pageCss).toContain(".press-job-page__table-body");
    expect(pageCss).toContain("overflow: auto");
    expect(pageCss).toContain(".press-job-page__signals-body");
    expect(pageCss).not.toContain("overflow-y: auto");
    expect(pageCss).not.toContain("linear-gradient");
    expect(pageCss).not.toContain("backdrop-filter");
  });

  /**
   * @brief 断言 Mold Lock Panel（模具锁定面板）在 1280x720 下使用两行紧凑布局。
   * @author PopoY
   */
  it("keeps the mold lock drawer toolbar and table compact", () => {
    expect(pageCss).toContain(".press-job-page__mold-lock-drawer .ant-drawer-body");
    expect(pageCss).toContain(".press-job-page__mold-lock-layout");
    expect(pageCss).toContain("grid-template-rows: 44px minmax(0, 1fr)");
    expect(pageCss).toContain(".press-job-page__mold-lock-toolbar");
    expect(pageCss).toContain("grid-template-columns: minmax(240px, 1fr) auto auto auto auto");
    expect(pageCss).toContain(".press-job-page__mold-lock-input");
    expect(pageCss).toContain(".press-job-page__mold-process-select");
    expect(pageCss).toContain(".press-job-page__mold-lock-toolbar .ant-btn");
    expect(pageCss).toContain("min-height: 44px");
    expect(pageCss).toContain(".press-job-page__mold-select-popup");
    expect(pageCss).toContain("--press-job-select-columns: 8");
    expect(pageCss).toContain("--press-job-select-visible-rows: 14");
    expect(pageCss).toContain(".press-job-page__mold-info-table");
    expect(pageCss).toContain("overflow: auto");
    expect(pageCss).not.toContain("decorative");
  });

  /**
   * @brief 断言 moldNo Select（模具号选择器）聚焦时只打开 custom keypad（自定义键盘），不同时弹出 popup（筛选浮层）。
   * @author PopoY
   */
  it("keeps the mold select popup closed while the mold keypad is active", () => {
    expect(pageSource).toContain("moldNoKeypadOpenRef");
    expect(pageSource).toContain("handleMoldSelectOpenChange");
    expect(pageSource).toContain("onOpenChange={handleMoldSelectOpenChange}");
    expect(pageSource).not.toContain("onOpenChange={setIsMoldSelectOpen}");
  });

  /**
   * @brief 断言 candidate select（候选选择）后保留 moldNo（模具号）显示值，避免 Ant Design auto clear（自动清空）覆盖。
   * @author PopoY
   */
  it("keeps the selected mold number visible after candidate click", () => {
    expect(pageSource).toContain("pendingSelectedMoldNoRef");
    expect(pageSource).toContain("pendingSelectedMoldNoRef.current = candidate.moldNo");
    expect(pageSource).toContain("const pendingSelectedMoldNo = pendingSelectedMoldNoRef.current");
  });

  /**
   * @brief 断言锁模面板按钮使用 icon（图标）和 state color（状态色）。
   * @author PopoY
   */
  it("uses icon and color styles for the four mold lock toolbar buttons", () => {
    expect(pageSource).toContain("press-job-page__mold-lock-button-icon");
    expect(pageSource).toContain('icon={createMoldLockButtonIcon("⌕")}');
    expect(pageSource).toContain('icon={createMoldLockButtonIcon("↺")}');
    expect(pageSource).toContain('icon={createMoldLockButtonIcon("✓")}');
    expect(pageSource).toContain('icon={createMoldLockButtonIcon("×")}');
    expect(pageSource).toContain('color="primary"');
    expect(pageSource).toContain('color="orange"');
    expect(pageSource).toContain('color="danger"');
  });

  /**
   * @brief 断言筛选 Select popup（选择器浮层）使用 touch grid（触控网格），不依赖滚动条。
   * @author PopoY
   */
  it("renders touch-ready multi-column select popups without virtual scrolling", () => {
    expect(pageSource).toContain("PRESS_JOB_TOUCH_SELECT_LIST_HEIGHT");
    expect(pageSource.match(/virtual={false}/g)?.length ?? 0).toBe(5);
    expect(pageSource.match(/popupMatchSelectWidth={false}/g)?.length ?? 0).toBe(5);
    expect(pageSource.match(/press-job-page__select-popup--two-column/g)?.length ?? 0).toBe(2);
    expect(pageSource.match(/press-job-page__select-popup--four-column/g)?.length ?? 0).toBe(2);
    expect(pageSource.match(/press-job-page__select-list/g)?.length ?? 0).toBe(5);
    expect(pageSource.match(/press-job-page__select-option/g)?.length ?? 0).toBe(5);
    const fourColumnPopupCss = extractSourceBetween(
      pageCss,
      ".press-job-page__select-popup--four-column",
      ".press-job-page__mold-select-popup",
    );

    expect(pageCss).toContain("--press-job-select-columns: 2");
    expect(fourColumnPopupCss).toContain("--press-job-select-columns: 4");
    expect(fourColumnPopupCss).toContain("--press-job-select-popup-width: 720px");
    expect(fourColumnPopupCss).not.toContain("--press-job-select-popup-width: 960px");
    expect(pageCss).toContain("--press-job-select-columns: 8");
    expect(pageCss).toContain("--press-job-select-visible-rows: 14");
    expect(pageCss).toContain("grid-template-columns: repeat(var(--press-job-select-columns), minmax(0, 1fr))");
    expect(pageCss).toContain("calc(var(--press-job-select-visible-rows) * 48px + 12 * 4px)");
    expect(pageCss).toContain("min-height: 48px");
    expect(pageCss).toContain("white-space: normal");
    expect(pageCss).toContain(
      ".press-job-page__mold-select-popup .press-job-page__select-option.ant-select-item-option-selected:not(.ant-select-item-option-disabled)",
    );
    expect(pageCss).toContain("background-color: rgba(0, 120, 200, 0.16) !important");
    expect(pageCss).not.toContain("overflow-y: auto");
  });
});

/**
 * @brief 创建测试用 driverSession（驱动会话），只保留 PressJobPage（压机作业页）需要字段。
 * @author PopoY
 * @param deviceSessionState Driver device session state（驱动设备会话状态）。
 * @returns 测试用 session（会话）。
 */
function createDriverSession(
  deviceSessionState: "Connected" | "Disconnected" | "CleanupPending",
) {
  return {
    data: {
      applyResult: {
        correlationId: "driver-cid-01",
        deviceSessionState,
        leaseState: "Active",
        resultCode: "OK",
      },
      signalSnapshot: null,
    },
    error: null,
    refreshSnapshot: async () => {},
    retry: async () => {},
    status: deviceSessionState === "Connected" ? "success" : "error",
  } as const;
}
