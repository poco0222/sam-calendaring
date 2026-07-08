/**
 * @file appconfigbridge.h - 声明 Qt App（Qt 应用）配置桥接。
 * @author PopoY
 * @created 2026-06-25
 * @brief 声明通过 QWebChannel（Qt Web 通道）暴露的只读 bootstrap config（启动引导配置）桥接。
 */

#pragma once

#include <QObject>
#include <QVariantMap>

/**
 * @brief Expose the minimal read-only bootstrap config required by the frontend.
 */
class AppConfigBridge final : public QObject {
    Q_OBJECT

public:
    /**
     * @brief Construct the bridge that exposes protected local bootstrap config.
     * @param parent Optional Qt parent object.
     */
    explicit AppConfigBridge(QObject *parent = nullptr);

    /**
     * @brief Return the read-only bootstrap config as a Qt variant map.
     * @return Bootstrap config fields expected by the frontend contract.
     */
    Q_INVOKABLE QVariantMap readBootstrapConfig() const;
};
