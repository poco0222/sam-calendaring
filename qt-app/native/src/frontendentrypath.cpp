/**
 * @file frontendentrypath.cpp - 实现 Qt App（Qt 应用）前端入口路径解析。
 * @author PopoY
 * @created 2026-06-25
 * @brief 解析 Qt shell（Qt 外壳）使用的前端构建入口文件。
 */

#include "frontendentrypath.h"

#include <QDir>
#include <QFileInfo>

namespace {
/**
 * @brief Build the `index.html` candidate path for one frontend dist directory.
 * @param distDirectory Frontend dist directory path.
 * @return Candidate absolute or relative `index.html` path.
 */
QString buildIndexPath(const QString &distDirectory) {
    return QDir(distDirectory).filePath(QStringLiteral("index.html"));
}

/**
 * @brief Check whether a candidate path points at a readable frontend entry file.
 * @param filePath Candidate `index.html` path.
 * @return True when the file exists and is a regular file.
 */
bool isEntryFileAvailable(const QString &filePath) {
    const QFileInfo fileInfo(filePath);
    return fileInfo.exists() && fileInfo.isFile();
}
}  // namespace

QString resolveFrontendEntryPath(const QString &applicationDirPath,
                                 const QString &frontendDistOverride) {
    const QString trimmedOverride = frontendDistOverride.trimmed();

    if (!trimmedOverride.isEmpty()) {
        const QString overrideEntryPath = buildIndexPath(trimmedOverride);

        if (isEntryFileAvailable(overrideEntryPath)) {
            return QDir::cleanPath(overrideEntryPath);
        }
    }

    const QString fallbackEntryPath =
        QDir(applicationDirPath).filePath(QStringLiteral("../../frontend/dist/index.html"));

    if (isEntryFileAvailable(fallbackEntryPath)) {
        return QDir::cleanPath(fallbackEntryPath);
    }

    return QString();
}
