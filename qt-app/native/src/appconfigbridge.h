/**
 * @file appconfigbridge.h - 声明 Qt App（Qt 应用）配置桥接。
 * @author PopoY
 * @created 2026-06-25
 * @brief 声明通过 QWebChannel（Qt Web 通道）暴露的 bootstrap config（启动配置）读写桥接。
 */

#pragma once

#include <QObject>
#include <QVariantMap>

/**
 * @brief 暴露 frontend（前端）需要的最小 bootstrap config（启动配置）读写接口。
 * @author PopoY
 */
class AppConfigBridge final : public QObject {
    Q_OBJECT

public:
    /**
     * @brief 构造暴露受控本机 bootstrap config（启动配置）的 bridge（桥）。
     * @author PopoY
     * @param parent 可选 Qt parent object（父对象）。
     */
    explicit AppConfigBridge(QObject *parent = nullptr);

    /**
     * @brief 读取本机 bootstrap config（启动配置）并返回 Qt variant map（变体映射）。
     * @author PopoY
     * @return frontend contract（前端契约）需要的六个 bootstrap config（启动配置）字段。
     */
    Q_INVOKABLE QVariantMap readBootstrapConfig() const;

    /**
     * @brief 保存六个 bootstrap config（启动配置）白名单字段到 QSettings（Qt 配置存储）。
     * @author PopoY
     * @param config frontend（前端）传入的 config map（配置映射），额外 key（键）会被忽略。
     * @return `{ ok, errorMessage }` 结构化保存结果。
     */
    Q_INVOKABLE QVariantMap saveBootstrapConfig(const QVariantMap &config) const;

    /**
     * @brief 读取当前工控机第一个可用 IPv4 address（IPv4 地址）。
     * @author PopoY
     * @return 可用地址；取不到时返回空字符串。
     */
    Q_INVOKABLE QString readDefaultHostAddress() const;
};
