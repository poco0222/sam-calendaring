# Task 01: Native Bridge Config Write And Default Host

> @file QT App native bridge（原生桥）配置写入与默认主机地址任务
> @author PopoY
> @created 2026-07-08
> @purpose 扩展 AppConfigBridge（应用配置桥），支持白名单 bootstrap config（启动配置）写入和 default IPv4 address（默认 IPv4 地址）读取。

## Goal（目标）

Add the smallest native surface（原生接口面） required by the UI（用户界面）: save exactly six bootstrap config（启动配置） fields into QSettings（Qt 配置存储）, return structured save results（结构化保存结果）, and expose a default host IPv4 address（默认主机 IPv4 地址）.

## Status（状态）

- `Completed（已完成）`: Task 01 complete（任务一完成），native focused tests（原生聚焦测试）已通过。

## Progress（进度）

- `2026-07-08`: Step 1 complete（步骤一完成），当前进度 `1/6`；已在 `qt-app/native/tests/config_bridge.spec.cpp` 增加 `saveBootstrapConfig` RED（红灯）契约测试，尚未进入实现。
- `2026-07-08`: Step 2 complete（步骤二完成），当前进度 `2/6`；已创建 `qt-app/native/tests/bootstrap_host_address.spec.cpp`，用于验证 default host IPv4 address（默认主机 IPv4 地址）筛选规则。
- `2026-07-08`: Step 3 complete（步骤三完成），当前进度 `3/6`；`qt-cmake --build build` 失败在 `no member named 'saveBootstrapConfig' in 'AppConfigBridge'`，符合 RED（红灯）预期；因 build（构建）失败未进入 `ctest`。
- `2026-07-08`: Step 4 complete（步骤四完成），当前进度 `4/6`；已在 `AppConfigBridge` 增加 `saveBootstrapConfig` 和 `readDefaultHostAddress`，保存逻辑只写六个 whitelist fields（白名单字段）并调用 `QSettings::sync()`。
- `2026-07-08`: Step 5 complete（步骤五完成），当前进度 `5/6`；已新增 `bootstraphostaddress.h/.cpp`，`readDefaultHostAddress()` 遍历 active network interface（活动网卡），`selectDefaultHostAddress()` 过滤 loopback/link-local/non-IPv4（回环/链路本地/非 IPv4）地址。
- `2026-07-08`: Step 6 complete（步骤六完成），当前进度 `6/6`；已接入 CMake（构建配置）并完成 GREEN（绿灯）验证：`ctest --test-dir build --output-on-failure` 结果为 `4/4 tests passed`。
- `2026-07-08`: Task 06（任务六）同步完成；native focused verification（原生聚焦验证）重新运行通过，`ctest --test-dir build --output-on-failure` 结果仍为 `4/4 tests passed`，本任务完成步数 `6/6`。

## Files（文件）

- Modify: `qt-app/native/src/appconfigbridge.h`
- Modify: `qt-app/native/src/appconfigbridge.cpp`
- Create: `qt-app/native/src/bootstraphostaddress.h`
- Create: `qt-app/native/src/bootstraphostaddress.cpp`
- Modify: `qt-app/native/CMakeLists.txt`
- Modify: `qt-app/native/tests/config_bridge.spec.cpp`
- Create: `qt-app/native/tests/bootstrap_host_address.spec.cpp`

## Acceptance（验收点）

1. `readBootstrapConfig()` keeps returning the same six fields（六个字段）.
2. `saveBootstrapConfig(config)` writes only six whitelisted fields（白名单字段） and ignores extra keys such as `sessionToken`.
3. `saveBootstrapConfig(config)` calls `QSettings::sync()` and returns `{ ok: true }` or `{ ok: false, errorMessage: "中文摘要" }`.
4. `readDefaultHostAddress()` returns the first active IPv4 address（活动 IPv4 地址） that is not loopback（回环） or link-local（链路本地）.
5. No `Console.WriteLine` equivalent（控制台直写） or sensitive payload（敏感载荷） logging is added.

## Steps（步骤）

- [x] **Step 1: Write RED config save contract test（编写失败的配置保存契约测试）**

Modify `qt-app/native/tests/config_bridge.spec.cpp`.

Add a second assertion block after the existing read assertions:

```cpp
/**
 * @brief 验证 saveBootstrapConfig（保存启动配置）只写入六个白名单字段。
 * @author PopoY
 */
const QVariantMap input{
    {QStringLiteral("stationAccountId"), QStringLiteral("station-new")},
    {QStringLiteral("granteeHostId"), QStringLiteral("host-new")},
    {QStringLiteral("stationId"), QStringLiteral("station-id-new")},
    {QStringLiteral("erpBaseUrl"), QStringLiteral("https://erp-new.example.test")},
    {QStringLiteral("driverBaseUrl"), QStringLiteral("https://driver-new.example.test")},
    {QStringLiteral("configVersion"), QStringLiteral("2026.07.08")},
    {QStringLiteral("sessionToken"), QStringLiteral("must-not-be-saved")},
};
const QVariantMap saveResult = bridge.saveBootstrapConfig(input);

if (!saveResult.value(QStringLiteral("ok")).toBool()) {
    return failSpec(saveResult.value(QStringLiteral("errorMessage")).toString());
}

const QVariantMap savedConfig = bridge.readBootstrapConfig();
if (savedConfig.value(QStringLiteral("stationAccountId")).toString() != QStringLiteral("station-new")) {
    return failSpec(QStringLiteral("stationAccountId was not saved"));
}

QSettings savedSettings;
if (savedSettings.contains(QStringLiteral("bootstrap/sessionToken"))) {
    return failSpec(QStringLiteral("sessionToken must not be saved"));
}
```

Expected RED（预期失败）:

```text
FAIL because AppConfigBridge::saveBootstrapConfig does not exist yet.
```

- [x] **Step 2: Write RED default host address test（编写失败的默认主机地址测试）**

Create `qt-app/native/tests/bootstrap_host_address.spec.cpp`.

```cpp
/**
 * @file bootstrap_host_address.spec.cpp - 验证默认 IPv4 address（IPv4 地址）选择规则。
 * @author PopoY
 * @created 2026-07-08
 * @brief 验证 QT App（Qt 应用）首启配置默认 granteeHostId（授权主机 ID）的地址筛选。
 */

#include "../src/bootstraphostaddress.h"

#include <QHostAddress>

#include <cstdlib>
#include <iostream>

namespace {
int failSpec(const QString &message) {
    std::cerr << message.toStdString() << std::endl;
    return EXIT_FAILURE;
}
}  // namespace

int main() {
    if (!selectDefaultHostAddress({QHostAddress::LocalHost, QHostAddress("169.254.1.2")}).isEmpty()) {
        return failSpec(QStringLiteral("loopback/link-local address must be ignored"));
    }

    const QString selected = selectDefaultHostAddress({
        QHostAddress::LocalHost,
        QHostAddress("fe80::1"),
        QHostAddress("192.168.19.100"),
        QHostAddress("10.0.0.2"),
    });

    if (selected != QStringLiteral("192.168.19.100")) {
        return failSpec(QStringLiteral("first usable IPv4 address was not selected"));
    }

    return EXIT_SUCCESS;
}
```

Expected RED（预期失败）:

```text
FAIL because bootstraphostaddress.h does not exist yet.
```

- [x] **Step 3: Run native tests and confirm RED（运行原生测试并确认失败）**

Run:

```bash
cd qt-app/native
/Users/PopoY/Qt/6.10.2/macos/bin/qt-cmake -S . -B build -G Ninja -D CMAKE_MAKE_PROGRAM=/Users/PopoY/Qt/Tools/Ninja/ninja
/Users/PopoY/Qt/6.10.2/macos/bin/qt-cmake --build build
/Users/PopoY/Qt/Tools/CMake/CMake.app/Contents/bin/ctest --test-dir build --output-on-failure
```

Expected（预期）:

```text
FAIL（失败） because new native methods and bootstrap_host_address_spec target are missing.
```

- [x] **Step 4: Add native bridge methods（新增原生桥方法）**

Modify `qt-app/native/src/appconfigbridge.h`.

```cpp
/**
 * @brief 保存六个 bootstrap config（启动配置）白名单字段到 QSettings（Qt 配置存储）。
 * @author PopoY
 * @param config 前端传入的配置 map（映射），额外 key（键）会被忽略。
 * @return `{ ok, errorMessage }` 结构化保存结果。
 */
Q_INVOKABLE QVariantMap saveBootstrapConfig(const QVariantMap &config) const;

/**
 * @brief 读取当前工控机第一个可用 IPv4 address（IPv4 地址）。
 * @author PopoY
 * @return 可用地址；取不到时返回空字符串。
 */
Q_INVOKABLE QString readDefaultHostAddress() const;
```

Modify `qt-app/native/src/appconfigbridge.cpp`.

Implementation rules（实现规则）:

1. Reuse existing `kConfigEntries` for both read and write.
2. Convert every whitelisted value to trimmed `QString`.
3. Call `settings.sync()` after all six values are set.
4. On `QSettings::NoError`, return `ok=true`.
5. On failure, return `ok=false` and `errorMessage="启动配置保存失败，请检查本机配置权限。"`; do not include raw exception text（异常原文）.

- [x] **Step 5: Add default host helper（新增默认主机地址辅助函数）**

Create `qt-app/native/src/bootstraphostaddress.h`.

```cpp
/**
 * @file bootstraphostaddress.h - 选择首启配置默认 IPv4 address（IPv4 地址）。
 * @author PopoY
 * @created 2026-07-08
 * @brief 暴露可测试的默认主机地址筛选函数。
 */

#pragma once

#include <QHostAddress>
#include <QString>

QString selectDefaultHostAddress(const QList<QHostAddress> &addresses);
QString readDefaultHostAddress();
```

Create `qt-app/native/src/bootstraphostaddress.cpp`.

Implementation rules（实现规则）:

1. `readDefaultHostAddress()` iterates `QNetworkInterface::allInterfaces()`.
2. Skip interfaces without `QNetworkInterface::IsUp` or without `QNetworkInterface::IsRunning`.
3. Skip `QNetworkInterface::IsLoopBack`.
4. Collect addresses and call `selectDefaultHostAddress(addresses)`.
5. `selectDefaultHostAddress()` returns the first IPv4 address（IPv4 地址） where `protocol() == QAbstractSocket::IPv4Protocol`, `!isLoopback()`, and `!isLinkLocal()`.

- [x] **Step 6: Wire CMake and verify GREEN（接入 CMake 并验证通过）**

Modify `qt-app/native/CMakeLists.txt`:

1. Add `src/bootstraphostaddress.cpp` to native app source list（源码列表）.
2. Add `bootstrap_host_address_spec` executable（可执行测试）.
3. Add `add_test(NAME bootstrap_host_address_spec COMMAND bootstrap_host_address_spec)`.

Run:

```bash
cd qt-app/native
/Users/PopoY/Qt/6.10.2/macos/bin/qt-cmake -S . -B build -G Ninja -D CMAKE_MAKE_PROGRAM=/Users/PopoY/Qt/Tools/Ninja/ninja
/Users/PopoY/Qt/6.10.2/macos/bin/qt-cmake --build build
/Users/PopoY/Qt/Tools/CMake/CMake.app/Contents/bin/ctest --test-dir build --output-on-failure
```

Expected（预期）:

```text
PASS（通过）: config_bridge_spec and bootstrap_host_address_spec both pass.
```

Commit message（提交消息，如执行时需要）:

```bash
git add qt-app/native
git commit -m "feat(qt-app): 增加 bootstrap config 原生读写"
```
