/**
 * @file mainwindow.cpp - 实现 Qt App（Qt 应用）主窗口。
 * @author PopoY
 * @created 2026-06-25
 * @brief 定义 bootstrap shell（启动引导外壳）的 Qt 主窗口。
 */

#include "mainwindow.h"

#include <QSize>
#include <QWebEngineSettings>
#include <QWebEngineView>
#include <QUrl>

MainWindow::MainWindow(const QString &frontendEntryPath, QWidget *parent)
    : QMainWindow(parent),
      frontendEntryPath_(frontendEntryPath),
      webView_(new QWebEngineView(this)) {
    setWindowTitle(QStringLiteral("SAM 启动工作台"));
    // PopoY: field IPC devices are fixed 10-inch 1280x720 touch screens.
    setFixedSize(QSize(1280, 720));
    setCentralWidget(webView_);
    // PopoY: frontend runs from local dist files and must call ERP/Driver HTTP endpoints during bootstrap.
    webView_->settings()->setAttribute(QWebEngineSettings::LocalContentCanAccessRemoteUrls, true);

    if (!frontendEntryPath.isEmpty()) {
        // PopoY: 延迟到 QWebChannel（Qt Web 通道）注册完成后再加载真实 frontend（前端）页面。
        return;
    }

    // PopoY: keep a readable fallback so native startup still proves the shell can render when dist is missing.
    webView_->setHtml(QStringLiteral(
        "<!doctype html><html><body><div id=\"root\">SAM 启动工作台已就绪。</div></body></html>"));
}

void MainWindow::loadFrontend() {
    if (frontendEntryPath_.isEmpty()) {
        return;
    }

    // PopoY: F5 debug（调试）必须加载最新构建的 frontend dist（前端产物）入口。
    webView_->setUrl(QUrl::fromLocalFile(frontendEntryPath_));
}
