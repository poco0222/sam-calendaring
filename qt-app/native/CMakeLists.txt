#
# @file QT App native shell（原生外壳）build entry（构建入口）
# @author PopoY
# @created 2026-06-25
# @brief 构建 bootstrap V1（启动引导 V1）的最小 Qt WebEngine native shell（原生外壳）。
#

cmake_minimum_required(VERSION 3.21)

project(qt_app_native LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_AUTOMOC ON)
set(CMAKE_AUTOUIC ON)
set(CMAKE_AUTORCC ON)

enable_testing()

find_package(Qt6 REQUIRED COMPONENTS Core Network WebEngineWidgets WebChannel)

qt_add_executable(qt_app_native
    src/appconfigbridge.cpp
    src/appconfigbridge.h
    src/bootstraphostaddress.cpp
    src/bootstraphostaddress.h
    src/frontendentrypath.cpp
    src/frontendentrypath.h
    src/main.cpp
    src/mainwindow.cpp
    src/mainwindow.h
)

target_link_libraries(qt_app_native
    PRIVATE
        Qt6::WebEngineWidgets
        Qt6::WebChannel
        Qt6::Network
)

add_executable(config_bridge_spec
    src/appconfigbridge.cpp
    src/appconfigbridge.h
    src/bootstraphostaddress.cpp
    src/bootstraphostaddress.h
    tests/config_bridge.spec.cpp
)

target_link_libraries(config_bridge_spec
    PRIVATE
        Qt6::Core
        Qt6::Network
)

add_test(NAME config_bridge_spec COMMAND config_bridge_spec)

add_executable(bootstrap_host_address_spec
    src/bootstraphostaddress.cpp
    src/bootstraphostaddress.h
    tests/bootstrap_host_address.spec.cpp
)

target_link_libraries(bootstrap_host_address_spec
    PRIVATE
        Qt6::Core
        Qt6::Network
)

add_test(NAME bootstrap_host_address_spec COMMAND bootstrap_host_address_spec)

add_executable(frontendentrypath_spec
    src/frontendentrypath.cpp
    src/frontendentrypath.h
    tests/frontendentrypath.spec.cpp
)

target_link_libraries(frontendentrypath_spec
    PRIVATE
        Qt6::Core
)

add_test(NAME frontendentrypath_spec COMMAND frontendentrypath_spec)

add_executable(mainwindow_spec
    src/mainwindow.cpp
    src/mainwindow.h
    tests/mainwindow.spec.cpp
)

target_link_libraries(mainwindow_spec
    PRIVATE
        Qt6::WebEngineWidgets
)

add_test(NAME mainwindow_spec COMMAND mainwindow_spec)
