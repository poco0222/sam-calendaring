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
 * @brief 维护 bootstrap config（启动配置）字段、QSettings（Qt 配置存储）key（键）和预期值。
 * @author PopoY
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
 * @brief 创建独立 application scope（应用作用域），避免测试写入用户真实配置。
 * @author PopoY
 * @return 独立 QSettings（Qt 配置存储）应用名。
 */
QString buildUniqueApplicationName() {
    return QStringLiteral("config-bridge-spec-%1").arg(QCoreApplication::applicationPid());
}

/**
 * @brief 输出断言失败信息，并用非零 exit code（退出码）结束 spec（规格测试）。
 * @author PopoY
 * @param message 中文或中英混合的失败详情。
 * @return 失败 spec（规格测试）的进程退出码。
 */
int failSpec(const QString &message) {
    std::cerr << message.toStdString() << std::endl;
    return EXIT_FAILURE;
}
}  // namespace

/**
 * @brief 执行不依赖 QTest（Qt 测试框架）的最小 config bridge（配置桥）spec（规格测试）。
 * @author PopoY
 * @param argc process argument count（进程参数数量）。
 * @param argv process argument values（进程参数值）。
 * @return 六个 bootstrap config（启动配置）字段读写正确时返回 EXIT_SUCCESS（成功退出码）。
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

        // PopoY: 先把 bootstrap key（启动配置键）写入隔离临时作用域，再通过 bridge（桥）读取。
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

    /**
     * @brief 验证 saveBootstrapConfig（保存启动配置）只写入六个白名单字段。
     * @author PopoY
     */
    const QVariantMap input{
        {QStringLiteral("stationAccountId"), QStringLiteral("station-new")},
        {QStringLiteral("granteeHostId"), QStringLiteral("host-new")},
        {QStringLiteral("stationId"), QStringLiteral("station-id-new")},
        {QStringLiteral("erpBaseUrl"), QStringLiteral("https://erp-new.example.test")},
        {QStringLiteral("driverBaseUrl"), QStringLiteral("https://driver-new.example.test")},
        {QStringLiteral("configVersion"), QStringLiteral("2026.07.08")},
        {QStringLiteral("sessionToken"), QStringLiteral("must-not-be-saved")},
    };
    const QVariantMap saveResult = bridge.saveBootstrapConfig(input);

    if (!saveResult.value(QStringLiteral("ok")).toBool()) {
        return failSpec(saveResult.value(QStringLiteral("errorMessage")).toString());
    }

    const QVariantMap savedConfig = bridge.readBootstrapConfig();
    for (const ConfigExpectation &expectation : kExpectations) {
        const QString fieldName = QString::fromUtf8(expectation.fieldName.data());
        const QString expectedValue = input.value(fieldName).toString();
        const QString actualValue = savedConfig.value(fieldName).toString();

        if (actualValue != expectedValue) {
            return failSpec(QStringLiteral("%1 was not saved").arg(fieldName));
        }
    }

    QSettings savedSettings;
    if (savedSettings.contains(QStringLiteral("bootstrap/sessionToken"))) {
        return failSpec(QStringLiteral("sessionToken must not be saved"));
    }

    return EXIT_SUCCESS;
}
