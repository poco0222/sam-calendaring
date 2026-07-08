/**
 * @file vite.config.ts
 * @author PopoY
 * @created 2026-06-25
 * @brief Configure the minimal Vite React frontend entry for QT App bootstrap.
 */

import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

/**
 * @brief Export the minimal Vite configuration for the frontend workspace.
 * @returns Vite configuration object.
 */
export default defineConfig({
  base: "./",
  plugins: [react()],
});
