/**
 * @file appconfigbridge.cpp - 实现 Qt App（Qt 应用）配置桥接。
 * @author PopoY
 * @created 2026-06-25
 * @brief 实现 QWebChannel（Qt Web 通道）bootstrap config（启动配置）受控读写桥接。
 */

#include "appconfigbridge.h"

#include "bootstraphostaddress.h"

#include <QSettings>

namespace {
/**
 * @brief 描述一个 bootstrap config（启动配置）字段如何映射到本机 QSettings（Qt 配置存储）。
 * @author PopoY
 */
struct ConfigEntry {
    const char *fieldName;
    const char *settingsKey;
};

// PopoY: 固定六个 bootstrap config（启动配置）字段，避免保存 runtime secret（运行期密钥）或额外 payload（载荷）。
constexpr ConfigEntry kConfigEntries[] = {
    {"stationAccountId", "bootstrap/stationAccountId"},
    {"granteeHostId", "bootstrap/granteeHostId"},
    {"stationId", "bootstrap/stationId"},
    {"erpBaseUrl", "bootstrap/erpBaseUrl"},
    {"driverBaseUrl", "bootstrap/driverBaseUrl"},
    {"configVersion", "bootstrap/configVersion"},
};
}  // namespace

AppConfigBridge::AppConfigBridge(QObject *parent)
    : QObject(parent) {}

QVariantMap AppConfigBridge::readBootstrapConfig() const {
    QSettings settings;
    QVariantMap config;

    for (const ConfigEntry &entry : kConfigEntries) {
        config.insert(QString::fromLatin1(entry.fieldName),
                      settings.value(QString::fromLatin1(entry.settingsKey)).toString());
    }

    return config;
}

/**
 * @brief 保存六个 bootstrap config（启动配置）白名单字段到 QSettings（Qt 配置存储）。
 * @author PopoY
 * @param config frontend（前端）传入的 config map（配置映射），额外 key（键）会被忽略。
 * @return `{ ok, errorMessage }` 结构化保存结果。
 */
QVariantMap AppConfigBridge::saveBootstrapConfig(const QVariantMap &config) const {
    QSettings settings;

    for (const ConfigEntry &entry : kConfigEntries) {
        const QString fieldName = QString::fromLatin1(entry.fieldName);
        settings.setValue(QString::fromLatin1(entry.settingsKey),
                          config.value(fieldName).toString().trimmed());
    }

    settings.sync();

    if (settings.status() != QSettings::NoError) {
        return {
            {QStringLiteral("ok"), false},
            {QStringLiteral("errorMessage"), QStringLiteral("启动配置保存失败，请检查本机配置权限。")},
        };
    }

    return {
        {QStringLiteral("ok"), true},
    };
}

/**
 * @brief 读取当前工控机第一个可用 IPv4 address（IPv4 地址）。
 * @author PopoY
 * @return 可用地址；取不到时返回空字符串。
 */
QString AppConfigBridge::readDefaultHostAddress() const {
    return ::readDefaultHostAddress();
}
