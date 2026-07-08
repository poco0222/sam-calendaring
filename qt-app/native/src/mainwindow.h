/**
 * @file mainwindow.h - 声明 Qt App（Qt 应用）主窗口。
 * @author PopoY
 * @created 2026-06-25
 * @brief 声明承载 WebEngine view（网页引擎视图）的 Qt 主窗口。
 */

#pragma once

#include <QMainWindow>
#include <QString>

class QWebEngineView;

/**
 * @brief Host the bootstrap WebEngine surface inside a single main window.
 */
class MainWindow final : public QMainWindow {
    Q_OBJECT

public:
    /**
     * @brief 构造 bootstrap（启动引导）主窗口。
     * @author PopoY
     * @param frontendEntryPath F5 debug（调试）和本地运行使用的前端 index.html 路径。
     * @param parent 可选 Qt parent object（父对象）。
     */
    explicit MainWindow(const QString &frontendEntryPath = QString(), QWidget *parent = nullptr);

    /**
     * @brief 在 QWebChannel（Qt Web 通道）注册后加载 frontend entry（前端入口）。
     * @author PopoY
     */
    Q_INVOKABLE void loadFrontend();

private:
    // PopoY: 缓存已解析的 frontend entry（前端入口），避免构造期早于 bridge（桥接）加载页面。
    QString frontendEntryPath_;
    // PopoY: 持有 bootstrap shell（启动引导外壳）的唯一 embedded browser（嵌入式浏览器）。
    QWebEngineView *webView_;
};
