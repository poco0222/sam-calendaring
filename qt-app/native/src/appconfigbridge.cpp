/**
 * @file appconfigbridge.cpp - 实现 Qt App（Qt 应用）配置桥接。
 * @author PopoY
 * @created 2026-06-25
 * @brief 实现 QWebChannel（Qt Web 通道）只读 bootstrap config（启动引导配置）桥接。
 */

#include "appconfigbridge.h"

#include <QSettings>

namespace {
/**
 * @brief Describe how one bootstrap config field maps to local Qt settings.
 */
struct ConfigEntry {
    const char *fieldName;
    const char *settingsKey;
};

// PopoY: keep the bootstrap config narrow and surface missing values so later tasks can enter ConfigInvalid.
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
