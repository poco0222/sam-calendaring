/**
 * @file bootstrap_host_address.spec.cpp - 验证默认 IPv4 address（IPv4 地址）选择规则。
 * @author PopoY
 * @created 2026-07-08
 * @brief 验证 QT App（Qt 应用）首启配置默认 granteeHostId（授权主机 ID）的地址筛选。
 */

#include "../src/bootstraphostaddress.h"

#include <QHostAddress>

#include <cstdlib>
#include <iostream>

namespace {
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
 * @brief 验证 selectDefaultHostAddress（选择默认主机地址）过滤 loopback/link-local（回环/链路本地）地址。
 * @author PopoY
 * @return 地址选择规则正确时返回 EXIT_SUCCESS（成功退出码）。
 */
int main() {
    if (!selectDefaultHostAddress({QHostAddress::LocalHost, QHostAddress("169.254.1.2")})
             .isEmpty()) {
        return failSpec(QStringLiteral("loopback/link-local address must be ignored"));
    }

    const QString selected = selectDefaultHostAddress({
        QHostAddress::LocalHost,
        QHostAddress("fe80::1"),
        QHostAddress("192.168.19.100"),
        QHostAddress("10.0.0.2"),
    });

    if (selected != QStringLiteral("192.168.19.100")) {
        return failSpec(QStringLiteral("first usable IPv4 address was not selected"));
    }

    return EXIT_SUCCESS;
}
