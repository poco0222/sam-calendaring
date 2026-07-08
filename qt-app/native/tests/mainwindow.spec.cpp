/**
 * @file mainwindow.spec.cpp - 验证 Qt App（Qt 应用）主窗口。
 * @author PopoY
 * @created 2026-06-25
 * @brief 验证 Qt bootstrap shell（启动引导外壳）窗口尺寸和网络访问。
 */

#include "../src/mainwindow.h"

#include <QApplication>
#include <QFile>
#include <QMetaObject>
#include <QSize>
#include <QTemporaryDir>
#include <QWebEngineSettings>
#include <QWebEngineView>
#include <QUrl>

#include <cstdlib>
#include <iostream>

namespace {
/**
 * @brief Print one assertion failure and stop the spec with a non-zero exit code.
 * @param message Human-readable failure detail.
 * @return Process exit code for the failing spec.
 */
int failSpec(const char *message) {
    std::cerr << message << std::endl;
    return EXIT_FAILURE;
}
}  // namespace

/**
 * @brief Execute the minimal main window spec without QTest.
 * @param argc Process argument count.
 * @param argv Process argument values.
 * @return EXIT_SUCCESS when the main window exposes the expected bootstrap shell behavior.
 */
int main(int argc, char *argv[]) {
    QApplication app(argc, argv);
    const MainWindow window;
    const QSize fieldDeviceSize(1280, 720);

    if (window.size() != fieldDeviceSize) {
        return failSpec("main window size must be 1280x720");
    }

    if (window.minimumSize() != fieldDeviceSize) {
        return failSpec("main window minimum size must be 1280x720");
    }

    if (window.maximumSize() != fieldDeviceSize) {
        return failSpec("main window maximum size must be 1280x720");
    }

    const auto *webView = window.findChild<QWebEngineView *>();
    if (webView == nullptr) {
        return failSpec("main window must own one QWebEngineView");
    }

    // PopoY: the frontend is loaded from file://, but it must call local ERP/Driver HTTP endpoints.
    if (!webView->settings()->testAttribute(QWebEngineSettings::LocalContentCanAccessRemoteUrls)) {
        return failSpec("local frontend must be allowed to call HTTP bootstrap endpoints");
    }

    const QTemporaryDir frontendDistDir;

    if (!frontendDistDir.isValid()) {
        return failSpec("frontend dist temp directory creation failed");
    }

    const QString frontendEntryPath = frontendDistDir.filePath(QStringLiteral("index.html"));
    QFile frontendEntryFile(frontendEntryPath);

    if (!frontendEntryFile.open(QIODevice::WriteOnly | QIODevice::Text)) {
        return failSpec("frontend entry test file creation failed");
    }

    frontendEntryFile.write("<!doctype html><html><body><div id=\"root\"></div></body></html>");
    frontendEntryFile.close();

    const MainWindow entryWindow(frontendEntryPath);
    auto *entryWebView = entryWindow.findChild<QWebEngineView *>();

    if (entryWebView == nullptr) {
        return failSpec("entry window must own one QWebEngineView");
    }

    // PopoY: QWebChannel must be registered by main.cpp before frontend JavaScript starts running.
    if (!entryWebView->url().isEmpty()) {
        return failSpec("frontend entry must not load during MainWindow construction");
    }

    if (!QMetaObject::invokeMethod(const_cast<MainWindow *>(&entryWindow), "loadFrontend")) {
        return failSpec("main window must expose delayed frontend loading");
    }

    if (entryWebView->url() != QUrl::fromLocalFile(frontendEntryPath)) {
        return failSpec("loadFrontend must load the resolved frontend entry");
    }

    return EXIT_SUCCESS;
}
