/**
 * @file ProjectShellTests.cs - 验证 Driver Service（驱动服务）项目骨架。
 * @author PopoY
 * @created 2026-06-26
 * @purpose 锁定 Driver Service 项目壳的默认配置和本机监听边界。
 */
using Microsoft.Extensions.Configuration;
using Sam.Calendaring.DriverService.Options;

namespace Sam.Calendaring.DriverService.Tests;

public sealed class ProjectShellTests
{
    /// <summary>
    /// 验证默认配置会绑定到 Real 模式、本机回环端口和本机主机身份。
    /// </summary>
    [Fact]
    public void DefaultConfigBindsDriverToRealModeAndLoopbackPort()
    {
        // PopoY: read the real appsettings.json so Task1 locks the persisted shell contract.
        var appSettingsPath = Path.GetFullPath(
            Path.Combine(
                AppContext.BaseDirectory,
                "../../../../../src/Sam.Calendaring.DriverService/appsettings.json"));

        var config = new ConfigurationBuilder()
            .AddJsonFile(appSettingsPath, optional: false, reloadOnChange: false)
            .Build();

        var driverOptions = config.GetSection("Driver").Get<DriverOptions>();
        var hostOptions = config.GetSection("HostIdentity").Get<HostIdentityOptions>();
        var urls = config["Urls"];

        Assert.Equal("Real", driverOptions?.Mode);
        Assert.Equal(5096, driverOptions?.Port);
        Assert.Equal("SAM-LOCAL-HOST", hostOptions?.GranteeHostId);
        Assert.Equal("http://127.0.0.1:5096", urls);
    }
}
