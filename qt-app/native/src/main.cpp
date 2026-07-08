/**
 * @file main.cpp - 启动 Qt App（Qt 应用）native（原生）进程。
 * @author PopoY
 * @created 2026-06-25
 * @brief 启动 bootstrap workspace（启动引导工作区）的 Qt native shell（原生外壳）。
 */

#include "appconfigbridge.h"
#include "frontendentrypath.h"
#include "mainwindow.h"

#include <QApplication>
#include <QWebChannel>
#include <QCoreApplication>
#include <QWebEngineView>

/**
 * @brief Initialize the Qt application and show the bootstrap shell window.
 * @param argc Native argument count from the process entry point.
 * @param argv Native argument values from the process entry point.
 * @return Qt event loop exit code.
 */
int main(int argc, char *argv[]) {
    QApplication app(argc, argv);
    AppConfigBridge appConfigBridge(&app);

    QApplication::setOrganizationName(QStringLiteral("PopoY"));
    QApplication::setApplicationName(QStringLiteral("qt-app-bootstrap"));

    const QString frontendEntryPath = resolveFrontendEntryPath(
        QCoreApplication::applicationDirPath(),
        qEnvironmentVariable("QT_APP_FRONTEND_DIST"));
    MainWindow window(frontendEntryPath);

    if (auto *webView = window.findChild<QWebEngineView *>(); webView != nullptr) {
        auto *channel = new QWebChannel(webView->page());

        // PopoY: register the native bridge once so the frontend can resolve it through QWebChannel.
        channel->registerObject(QStringLiteral("appConfigBridge"), &appConfigBridge);
        webView->page()->setWebChannel(channel);
    }

    // PopoY: bridge（桥接）注册完成后再加载 frontend（前端），避免 JS 早于 native object（原生对象）初始化。
    window.loadFrontend();

    // PopoY: bootstrap shell owns the WebEngine window only in Task 01.
    window.show();
    return app.exec();
}
