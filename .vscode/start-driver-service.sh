#!/bin/zsh
#
# @file start-driver-service.sh
# @author PopoY
# @created 2026-07-12
# @brief 在 launchd（macOS 服务管理器）中启动本项目 Driver Service（驱动服务）。

set -eu
set -o pipefail

readonly WORKSPACE_ROOT="${0:A:h:h}"
readonly DRIVER_PROJECT_DIR="${WORKSPACE_ROOT}/driver-service/src/Sam.Calendaring.DriverService"
readonly DRIVER_DLL="${DRIVER_PROJECT_DIR}/bin/Debug/net10.0/Sam.Calendaring.DriverService.dll"
readonly MANAGED_DOTNET_ROOT="/Users/popoy/WorkSpace/DevTools/C-Family/CSharp/dotnet"

export DOTNET_ROOT="${MANAGED_DOTNET_ROOT}"
export DOTNET_CLI_HOME="${MANAGED_DOTNET_ROOT:h}/dotnet-home"
export PATH="${DOTNET_ROOT}:/usr/bin:/bin:/usr/sbin:/sbin"
export ASPNETCORE_ENVIRONMENT="Development"
export Driver__Mode="Real"
export Driver__Port="5096"

cd "${DRIVER_PROJECT_DIR}"
exec "${DOTNET_ROOT}/dotnet" "${DRIVER_DLL}"
