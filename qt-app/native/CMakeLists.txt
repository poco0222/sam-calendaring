#
# @file QT App native shell build entry
# @author PopoY
# @created 2026-06-25
# @brief Build the minimal Qt WebEngine native shell for bootstrap V1.
#

cmake_minimum_required(VERSION 3.21)

project(qt_app_native LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_AUTOMOC ON)
set(CMAKE_AUTOUIC ON)
set(CMAKE_AUTORCC ON)

enable_testing()

find_package(Qt6 REQUIRED COMPONENTS Core WebEngineWidgets WebChannel)

qt_add_executable(qt_app_native
    src/appconfigbridge.cpp
    src/appconfigbridge.h
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
)

add_executable(config_bridge_spec
    src/appconfigbridge.cpp
    src/appconfigbridge.h
    tests/config_bridge.spec.cpp
)

target_link_libraries(config_bridge_spec
    PRIVATE
        Qt6::Core
)

add_test(NAME config_bridge_spec COMMAND config_bridge_spec)

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
