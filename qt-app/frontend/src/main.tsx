/**
 * @file main.tsx - 挂载 Qt App（Qt 应用）React（前端框架）入口。
 * @author PopoY
 * @created 2026-06-25
 * @brief 使用单一 Ant Design（前端组件库）根 provider（提供器）挂载 QT App 前端。
 */

import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { AntdRootProvider } from "./app/AntdRootProvider";
import "./global.css";

/**
 * @brief Render the frontend application into the root DOM container.
 * @returns Nothing.
 */
function bootstrap(): void {
  const rootElement = document.getElementById("root");

  if (!rootElement) {
    throw new Error("Missing #root container for QT App frontend bootstrap.");
  }

  // Keep bootstrap minimal so later tasks can own business orchestration.
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <AntdRootProvider>
        <App />
      </AntdRootProvider>
    </React.StrictMode>,
  );
}

bootstrap();
