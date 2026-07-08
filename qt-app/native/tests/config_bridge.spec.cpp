/**
 * @file config_bridge.spec.cpp - 验证 Qt App（Qt 应用）配置桥接。
 * @author PopoY
 * @created 2026-06-25
 * @brief 验证 AppConfigBridge（应用配置桥接）读取隔离本地设置。
 */

#include "../src/appconfigbridge.h"

#include <QCoreApplication>
#include <QSettings>
#include <QTemporaryDir>

#include <cstdlib>
#include <iostream>
#include <string_view>

namespace {
/**
 * @brief Keep one bootstrap field expectation together with its settings key.
 */
struct ConfigExpectation {
    std::string_view fieldName;
    std::string_view settingsKey;
    std::string_view expectedValue;
};

constexpr ConfigExpectation kExpectations[] = {
    {"stationAccountId", "bootstrap/stationAccountId", "station-account-id"},
    {"granteeHostId", "bootstrap/granteeHostId", "grantee-host-id"},
    {"stationId", "bootstrap/stationId", "station-id"},
    {"erpBaseUrl", "bootstrap/erpBaseUrl", "https://erp.example.test"},
    {"driverBaseUrl", "bootstrap/driverBaseUrl", "https://driver.example.test"},
    {"configVersion", "bootstrap/configVersion", "2026.06.25"},
};

/**
 * @brief Create a unique application scope so the spec never touches user settings.
 * @return Unique application name for the isolated settings scope.
 */
QString buildUniqueApplicationName() {
    return QStringLiteral("config-bridge-spec-%1").arg(QCoreApplication::applicationPid());
}

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
 * @brief Execute the minimal config bridge spec without QTest.
 * @param argc Process argument count.
 * @param argv Process argument values.
 * @return EXIT_SUCCESS when every bootstrap field round-trips correctly.
 */
int main(int argc, char *argv[]) {
    QCoreApplication app(argc, argv);
    const QTemporaryDir tempDir;

    if (!tempDir.isValid()) {
        return failSpec(QStringLiteral("temporary settings directory creation failed"));
    }

    QCoreApplication::setOrganizationName(QStringLiteral("PopoY"));
    QCoreApplication::setOrganizationDomain(QStringLiteral("popoy.local"));
    QCoreApplication::setApplicationName(buildUniqueApplicationName());

    QSettings::setDefaultFormat(QSettings::IniFormat);
    QSettings::setPath(QSettings::IniFormat, QSettings::UserScope, tempDir.path());

    {
        QSettings bootstrapSettings;

        // PopoY: write every bootstrap key into an isolated temp scope before reading through the bridge.
        for (const ConfigExpectation &expectation : kExpectations) {
            bootstrapSettings.setValue(QString::fromUtf8(expectation.settingsKey.data()),
                                       QString::fromUtf8(expectation.expectedValue.data()));
        }

        bootstrapSettings.sync();

        if (bootstrapSettings.status() != QSettings::NoError) {
            return failSpec(QStringLiteral("bootstrap settings sync failed"));
        }
    }

    const AppConfigBridge bridge;
    const QVariantMap config = bridge.readBootstrapConfig();

    for (const ConfigExpectation &expectation : kExpectations) {
        const QString fieldName = QString::fromUtf8(expectation.fieldName.data());
        const QString actualValue = config.value(fieldName).toString();
        const QString expectedValue = QString::fromUtf8(expectation.expectedValue.data());

        if (actualValue != expectedValue) {
            return failSpec(QStringLiteral("field %1 expected %2 but got %3")
                                .arg(fieldName, expectedValue, actualValue));
        }
    }

    return EXIT_SUCCESS;
}
