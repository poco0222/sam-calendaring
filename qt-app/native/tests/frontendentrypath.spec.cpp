/**
 * @file frontendentrypath.spec.cpp - 验证前端入口路径解析。
 * @author PopoY
 * @created 2026-06-25
 * @brief 验证 F5 debug（调试）时 Qt shell（Qt 外壳）前端入口解析。
 */

#include "../src/frontendentrypath.h"

#include <QDir>
#include <QTemporaryDir>

#include <cstdlib>
#include <iostream>

namespace {
/**
 * @brief Print one assertion failure and stop the spec with a non-zero exit code.
 * @param message Human-readable failure detail.
 * @return Process exit code for the failing spec.
 */
int failSpec(const QString &message) {
    std::cerr << message.toStdString() << std::endl;
    return EXIT_FAILURE;
}
}  // namespace

/**
 * @brief Execute the minimal frontend entry path spec without QTest.
 * @return EXIT_SUCCESS when override and fallback path resolution both work.
 */
int main() {
    QTemporaryDir tempDir;

    if (!tempDir.isValid()) {
        return failSpec(QStringLiteral("temporary project directory creation failed"));
    }

    QDir projectRoot(tempDir.path());

    if (!projectRoot.mkpath(QStringLiteral("qt-app/native/build"))) {
        return failSpec(QStringLiteral("native build directory creation failed"));
    }

    if (!projectRoot.mkpath(QStringLiteral("qt-app/frontend/dist"))) {
        return failSpec(QStringLiteral("frontend dist directory creation failed"));
    }

    const QString applicationDirPath = projectRoot.filePath(QStringLiteral("qt-app/native/build"));
    const QString fallbackEntryPath =
        projectRoot.filePath(QStringLiteral("qt-app/frontend/dist/index.html"));

    QFile fallbackEntryFile(fallbackEntryPath);

    if (!fallbackEntryFile.open(QIODevice::WriteOnly | QIODevice::Text)) {
        return failSpec(QStringLiteral("fallback entry file creation failed"));
    }

    fallbackEntryFile.write("<!doctype html><html><body>fallback</body></html>");
    fallbackEntryFile.close();

    if (resolveFrontendEntryPath(applicationDirPath).isEmpty()) {
        return failSpec(QStringLiteral("fallback relative dist path should resolve"));
    }

    const QString overrideDistPath = projectRoot.filePath(QStringLiteral("custom-dist"));

    if (!projectRoot.mkpath(QStringLiteral("custom-dist"))) {
        return failSpec(QStringLiteral("override dist directory creation failed"));
    }

    QFile overrideEntryFile(QDir(overrideDistPath).filePath(QStringLiteral("index.html")));

    if (!overrideEntryFile.open(QIODevice::WriteOnly | QIODevice::Text)) {
        return failSpec(QStringLiteral("override entry file creation failed"));
    }

    overrideEntryFile.write("<!doctype html><html><body>override</body></html>");
    overrideEntryFile.close();

    if (resolveFrontendEntryPath(applicationDirPath, overrideDistPath)
        != QDir(overrideDistPath).filePath(QStringLiteral("index.html"))) {
        return failSpec(QStringLiteral("override dist path should take precedence"));
    }

    return EXIT_SUCCESS;
}
