/**
 * @file bootstraphostaddress.h - 选择首启配置默认 IPv4 address（IPv4 地址）。
 * @author PopoY
 * @created 2026-07-08
 * @brief 暴露可测试的默认主机地址筛选函数。
 */

#pragma once

#include <QHostAddress>
#include <QList>
#include <QString>

/**
 * @brief 从候选地址中选择第一个可用 IPv4 address（IPv4 地址）。
 * @author PopoY
 * @param addresses 待筛选的 network address（网络地址）列表。
 * @return 第一个非 loopback/link-local（回环/链路本地）的 IPv4 address（IPv4 地址）；没有则返回空字符串。
 */
QString selectDefaultHostAddress(const QList<QHostAddress> &addresses);

/**
 * @brief 从当前 active network interface（活动网卡）读取默认 IPv4 address（IPv4 地址）。
 * @author PopoY
 * @return 第一个可用 IPv4 address（IPv4 地址）；没有则返回空字符串。
 */
QString readDefaultHostAddress();
