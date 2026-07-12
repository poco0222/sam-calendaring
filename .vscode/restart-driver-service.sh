#!/bin/zsh
#
# @file restart-driver-service.sh
# @author PopoY
# @created 2026-06-27
# @brief 重启 Driver Service（驱动服务），供 Qt debug（调试）前置任务使用。

set -eu
set -o pipefail

readonly WORKSPACE_ROOT="${0:A:h:h}"
readonly DRIVER_DLL="${WORKSPACE_ROOT}/driver-service/src/Sam.Calendaring.DriverService/bin/Debug/net10.0/Sam.Calendaring.DriverService.dll"
readonly START_SCRIPT="${0:A:h}/start-driver-service.sh"
readonly LAUNCH_AGENT_LABEL="com.popoy.sam-calendaring-driver"
readonly HEALTH_URL="http://127.0.0.1:5096/health"
readonly STDOUT_LOG="/tmp/sam-calendaring-driver.log"
readonly STDERR_LOG="/tmp/sam-calendaring-driver.err.log"

if [[ ! -x "${START_SCRIPT}" ]]; then
  echo "Driver Service 启动脚本不存在或不可执行: ${START_SCRIPT}" >&2
  exit 1
fi

# PopoY: 清理上一次 ad-hoc launchd job（临时服务任务），无需依赖用户目录下的外部 plist（服务配置）。
launchctl remove "${LAUNCH_AGENT_LABEL}" >/dev/null 2>&1 || true

# PopoY: 只结束当前 Driver Service（驱动服务）进程，不碰其他 dotnet（.NET 运行时）服务或无关 port（端口）。
existing_pids="$(pgrep -f "${DRIVER_DLL}" || true)"
if [[ -n "${existing_pids}" ]]; then
  while IFS= read -r pid; do
    [[ -n "${pid}" ]] && kill "${pid}" >/dev/null 2>&1 || true
  done <<< "${existing_pids}"
fi

for _ in {1..20}; do
  [[ -z "$(pgrep -f "${DRIVER_DLL}" || true)" ]] && break
  sleep 0.25
done

remaining_pids="$(pgrep -f "${DRIVER_DLL}" || true)"
if [[ -n "${remaining_pids}" ]]; then
  while IFS= read -r pid; do
    [[ -n "${pid}" ]] && kill -KILL "${pid}" >/dev/null 2>&1 || true
  done <<< "${remaining_pids}"
fi

# PopoY: 由 launchd（macOS 服务管理器）托管进程，避免 VS Code task（任务）退出时带走后台进程。
launchctl submit \
  -l "${LAUNCH_AGENT_LABEL}" \
  -o "${STDOUT_LOG}" \
  -e "${STDERR_LOG}" \
  -- "${START_SCRIPT}"

# PopoY: 等待 health check（健康检查）成功，防止 Qt App（Qt 应用）先于驱动可用状态启动。
for _ in {1..40}; do
  if curl -fsS --max-time 1 "${HEALTH_URL}" >/dev/null 2>&1; then
    echo "Driver Service 已启动: ${HEALTH_URL}"
    exit 0
  fi
  sleep 0.25
done

echo "Driver Service 启动超时，stdout log（标准输出日志）如下：" >&2
tail -n 80 "${STDOUT_LOG}" >&2 || true
echo "Driver Service stderr log（错误日志）如下：" >&2
tail -n 80 "${STDERR_LOG}" >&2 || true
exit 1
