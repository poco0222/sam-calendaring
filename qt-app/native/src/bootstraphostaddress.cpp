/**
 * @file bootstraphostaddress.cpp - 实现首启配置默认 IPv4 address（IPv4 地址）选择。
 * @author PopoY
 * @created 2026-07-08
 * @brief 从 active network interface（活动网卡）中筛选默认 granteeHostId（授权主机 ID）地址。
 */

#include "bootstraphostaddress.h"

#include <QNetworkAddressEntry>
#include <QNetworkInterface>

/**
 * @brief 从候选地址中选择第一个可用 IPv4 address（IPv4 地址）。
 * @author PopoY
 * @param addresses 待筛选的 network address（网络地址）列表。
 * @return 第一个非 loopback/link-local（回环/链路本地）的 IPv4 address（IPv4 地址）；没有则返回空字符串。
 */
QString selectDefaultHostAddress(const QList<QHostAddress> &addresses) {
    for (const QHostAddress &address : addresses) {
        // PopoY: 首启默认值只接受现场网络可路由的 IPv4 address（IPv4 地址）。
        if (address.protocol() == QAbstractSocket::IPv4Protocol && !address.isLoopback()
            && !address.isLinkLocal()) {
            return address.toString();
        }
    }

    return {};
}

/**
 * @brief 从当前 active network interface（活动网卡）读取默认 IPv4 address（IPv4 地址）。
 * @author PopoY
 * @return 第一个可用 IPv4 address（IPv4 地址）；没有则返回空字符串。
 */
QString readDefaultHostAddress() {
    for (const QNetworkInterface &networkInterface : QNetworkInterface::allInterfaces()) {
        const QNetworkInterface::InterfaceFlags flags = networkInterface.flags();

        if (!flags.testFlag(QNetworkInterface::IsUp)
            || !flags.testFlag(QNetworkInterface::IsRunning)
            || flags.testFlag(QNetworkInterface::IsLoopBack)) {
            continue;
        }

        QList<QHostAddress> addresses;
        for (const QNetworkAddressEntry &entry : networkInterface.addressEntries()) {
            addresses.append(entry.ip());
        }

        const QString selectedAddress = selectDefaultHostAddress(addresses);
        if (!selectedAddress.isEmpty()) {
            return selectedAddress;
        }
    }

    return {};
}
