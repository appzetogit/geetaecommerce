import { Request, Response } from "express";
import ThemeSettings, {
  DEFAULT_GLOBAL_THEME,
  DEFAULT_CUSTOMER_THEME,
} from "../../../models/ThemeSettings";

// Helper: Snapshot the current theme for history (plain objects, not Mongoose subdocs)
const snapshotTheme = (settings: any, userId?: string) => ({
  globalTheme: JSON.parse(JSON.stringify(settings.globalTheme)),
  customerTheme: JSON.parse(JSON.stringify(settings.customerTheme)),
  changedAt: new Date(),
  changedBy: userId as any,
});

/**
 * GET /api/v1/theme
 * Public endpoint - Returns both global and customer themes
 */
export const getTheme = async (_req: Request, res: Response): Promise<void> => {
  try {
    const settings = await ThemeSettings.getSettings();
    res.json({
      success: true,
      data: {
        globalTheme: settings.globalTheme,
        customerTheme: settings.customerTheme,
        darkMode: settings.darkMode,
      },
    });
  } catch (error: any) {
    console.error("Error fetching theme:", error);
    res.status(500).json({ success: false, message: "Failed to fetch theme settings", error: error.message });
  }
};

/**
 * GET /api/v1/theme/admin
 * Admin endpoint - Returns full theme settings including history
 */
export const getFullThemeSettings = async (_req: Request, res: Response): Promise<void> => {
  try {
    const settings = await ThemeSettings.getSettings();
    res.json({
      success: true,
      data: {
        globalTheme: settings.globalTheme,
        customerTheme: settings.customerTheme,
        darkMode: settings.darkMode,
        themeHistory: settings.themeHistory || [],
        scheduledTheme: settings.scheduledTheme,
        updatedAt: settings.updatedAt,
        updatedBy: settings.updatedBy,
      },
    });
  } catch (error: any) {
    console.error("Error fetching full theme settings:", error);
    res.status(500).json({ success: false, message: "Failed to fetch theme settings", error: error.message });
  }
};

/**
 * PUT /api/v1/admin/theme/global
 * Admin only - Update global platform theme
 */
export const updateGlobalTheme = async (req: Request, res: Response): Promise<void> => {
  try {
    const settings = await ThemeSettings.getSettings();

    // Push current to history
    settings.themeHistory.push(snapshotTheme(settings, req.user?.userId));

    // Merge incoming colors with existing (partial updates supported)
    const current = JSON.parse(JSON.stringify(settings.globalTheme));
    Object.assign(current, req.body);
    settings.globalTheme = current;
    settings.updatedBy = req.user?.userId as any;

    await settings.save();

    // Emit realtime theme update via Socket.IO
    const io = req.app.get("io");
    if (io) {
      io.emit("themeUpdated", { type: "global", globalTheme: settings.globalTheme, customerTheme: settings.customerTheme });
    }

    res.json({ success: true, message: "Global theme updated successfully", data: { globalTheme: settings.globalTheme, customerTheme: settings.customerTheme } });
  } catch (error: any) {
    console.error("Error updating global theme:", error);
    res.status(500).json({ success: false, message: "Failed to update global theme", error: error.message });
  }
};

/**
 * PUT /api/v1/admin/theme/customer
 * Admin only - Update customer app theme
 */
export const updateCustomerTheme = async (req: Request, res: Response): Promise<void> => {
  try {
    const settings = await ThemeSettings.getSettings();

    settings.themeHistory.push(snapshotTheme(settings, req.user?.userId));

    const current = JSON.parse(JSON.stringify(settings.customerTheme));
    Object.assign(current, req.body);
    settings.customerTheme = current;
    settings.updatedBy = req.user?.userId as any;

    await settings.save();

    const io = req.app.get("io");
    if (io) {
      io.emit("themeUpdated", { type: "customer", globalTheme: settings.globalTheme, customerTheme: settings.customerTheme });
    }

    res.json({ success: true, message: "Customer theme updated successfully", data: { globalTheme: settings.globalTheme, customerTheme: settings.customerTheme } });
  } catch (error: any) {
    console.error("Error updating customer theme:", error);
    res.status(500).json({ success: false, message: "Failed to update customer theme", error: error.message });
  }
};

/**
 * POST /api/v1/admin/theme/reset
 * Admin only - Reset theme to defaults
 */
export const resetTheme = async (req: Request, res: Response): Promise<void> => {
  try {
    const settings = await ThemeSettings.getSettings();

    settings.themeHistory.push(snapshotTheme(settings, req.user?.userId));

    settings.globalTheme = { ...DEFAULT_GLOBAL_THEME } as any;
    settings.customerTheme = { ...DEFAULT_CUSTOMER_THEME } as any;
    settings.updatedBy = req.user?.userId as any;

    await settings.save();

    const io = req.app.get("io");
    if (io) {
      io.emit("themeUpdated", { type: "reset", globalTheme: settings.globalTheme, customerTheme: settings.customerTheme });
    }

    res.json({ success: true, message: "Theme reset to defaults", data: { globalTheme: settings.globalTheme, customerTheme: settings.customerTheme } });
  } catch (error: any) {
    console.error("Error resetting theme:", error);
    res.status(500).json({ success: false, message: "Failed to reset theme", error: error.message });
  }
};

/**
 * POST /api/v1/admin/theme/import
 * Admin only - Import theme from JSON
 */
export const importTheme = async (req: Request, res: Response): Promise<void> => {
  try {
    const { globalTheme, customerTheme } = req.body;

    if (!globalTheme && !customerTheme) {
      res.status(400).json({ success: false, message: "At least one theme (global or customer) is required" });
      return;
    }

    const settings = await ThemeSettings.getSettings();
    settings.themeHistory.push(snapshotTheme(settings, req.user?.userId));

    if (globalTheme) {
      const current = JSON.parse(JSON.stringify(settings.globalTheme));
      Object.assign(current, globalTheme);
      settings.globalTheme = current;
    }
    if (customerTheme) {
      const current = JSON.parse(JSON.stringify(settings.customerTheme));
      Object.assign(current, customerTheme);
      settings.customerTheme = current;
    }
    settings.updatedBy = req.user?.userId as any;

    await settings.save();

    const io = req.app.get("io");
    if (io) {
      io.emit("themeUpdated", { type: "import", globalTheme: settings.globalTheme, customerTheme: settings.customerTheme });
    }

    res.json({ success: true, message: "Theme imported successfully", data: { globalTheme: settings.globalTheme, customerTheme: settings.customerTheme } });
  } catch (error: any) {
    console.error("Error importing theme:", error);
    res.status(500).json({ success: false, message: "Failed to import theme", error: error.message });
  }
};

/**
 * POST /api/v1/admin/theme/restore/:index
 * Admin only - Restore theme from history
 */
export const restoreThemeFromHistory = async (req: Request, res: Response): Promise<void> => {
  try {
    const historyIndex = parseInt(req.params.index, 10);
    const settings = await ThemeSettings.getSettings();

    if (isNaN(historyIndex) || historyIndex < 0 || historyIndex >= (settings.themeHistory?.length || 0)) {
      res.status(400).json({ success: false, message: "Invalid history index" });
      return;
    }

    const historicalTheme = settings.themeHistory[historyIndex];

    settings.themeHistory.push(snapshotTheme(settings, req.user?.userId));

    settings.globalTheme = JSON.parse(JSON.stringify(historicalTheme.globalTheme));
    settings.customerTheme = JSON.parse(JSON.stringify(historicalTheme.customerTheme));
    settings.updatedBy = req.user?.userId as any;

    await settings.save();

    const io = req.app.get("io");
    if (io) {
      io.emit("themeUpdated", { type: "restore", globalTheme: settings.globalTheme, customerTheme: settings.customerTheme });
    }

    res.json({ success: true, message: "Theme restored from history", data: { globalTheme: settings.globalTheme, customerTheme: settings.customerTheme } });
  } catch (error: any) {
    console.error("Error restoring theme:", error);
    res.status(500).json({ success: false, message: "Failed to restore theme", error: error.message });
  }
};

/**
 * PUT /api/v1/admin/theme/dark-mode
 * Admin only - Toggle dark mode settings
 */
export const updateDarkMode = async (req: Request, res: Response): Promise<void> => {
  try {
    const { enabled, auto } = req.body;
    const settings = await ThemeSettings.getSettings();

    if (typeof enabled === "boolean") settings.darkMode.enabled = enabled;
    if (typeof auto === "boolean") settings.darkMode.auto = auto;
    settings.updatedBy = req.user?.userId as any;

    await settings.save();

    const io = req.app.get("io");
    if (io) {
      io.emit("themeUpdated", { type: "darkMode", darkMode: settings.darkMode, globalTheme: settings.globalTheme, customerTheme: settings.customerTheme });
    }

    res.json({ success: true, message: "Dark mode settings updated", data: { darkMode: settings.darkMode } });
  } catch (error: any) {
    console.error("Error updating dark mode:", error);
    res.status(500).json({ success: false, message: "Failed to update dark mode", error: error.message });
  }
};
