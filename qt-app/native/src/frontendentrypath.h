/**
 * @file frontendentrypath.h - 声明前端入口路径解析接口。
 * @author PopoY
 * @created 2026-06-25
 * @brief 声明 Qt shell（Qt 外壳）前端入口解析辅助接口。
 */

#pragma once

#include <QString>

/**
 * @brief Resolve the built frontend index.html path from an optional dist override or the native build layout.
 * @param applicationDirPath Native application directory, usually the `build` folder during F5 debug.
 * @param frontendDistOverride Optional frontend dist directory override from the debug environment.
 * @return Absolute index.html path when found, otherwise an empty string.
 */
QString resolveFrontendEntryPath(const QString &applicationDirPath,
                                 const QString &frontendDistOverride = QString());
