import mongoose, { Document, Schema } from "mongoose";

// ─── Color sub-schema shared by both global and customer themes ───
const colorField = (defaultValue: string) => ({
  type: String,
  trim: true,
  default: defaultValue,
  validate: {
    validator: (v: string) => /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(v),
    message: (props: any) => `${props.value} is not a valid hex color`,
  },
});

// ─── Interfaces ───
export interface IThemeColors {
  primary: string;
  secondary: string;
  accent: string;
  background: string;
  text: string;
  success: string;
  warning: string;
  danger: string;
}

export interface IGlobalTheme extends IThemeColors {
  sidebar: string;
  navbar: string;
}

export interface IThemeHistory {
  globalTheme: IGlobalTheme;
  customerTheme: IThemeColors;
  changedAt: Date;
  changedBy?: mongoose.Types.ObjectId;
}

export interface IThemeSettings extends Document {
  globalTheme: IGlobalTheme;
  customerTheme: IThemeColors;
  darkMode: {
    enabled: boolean;
    auto: boolean;
  };
  themeHistory: IThemeHistory[];
  scheduledTheme?: {
    globalTheme?: IGlobalTheme;
    customerTheme?: IThemeColors;
    activateAt: Date;
    active: boolean;
  };
  updatedBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export interface IThemeSettingsModel extends mongoose.Model<IThemeSettings> {
  getSettings(): Promise<IThemeSettings>;
}

// ─── Default theme values ───
export const DEFAULT_GLOBAL_THEME: IGlobalTheme = {
  primary: "#2563eb",
  secondary: "#1e40af",
  accent: "#f59e0b",
  background: "#ffffff",
  sidebar: "#1e293b",
  navbar: "#1e293b",
  text: "#111827",
  success: "#10b981",
  warning: "#f59e0b",
  danger: "#ef4444",
};

export const DEFAULT_CUSTOMER_THEME: IThemeColors = {
  primary: "#ef4444",
  secondary: "#dc2626",
  accent: "#f97316",
  background: "#ffffff",
  text: "#111827",
  success: "#10b981",
  warning: "#f59e0b",
  danger: "#ef4444",
};

// ─── Schema ───
const globalThemeSchema = {
  primary: colorField(DEFAULT_GLOBAL_THEME.primary),
  secondary: colorField(DEFAULT_GLOBAL_THEME.secondary),
  accent: colorField(DEFAULT_GLOBAL_THEME.accent),
  background: colorField(DEFAULT_GLOBAL_THEME.background),
  sidebar: colorField(DEFAULT_GLOBAL_THEME.sidebar),
  navbar: colorField(DEFAULT_GLOBAL_THEME.navbar),
  text: colorField(DEFAULT_GLOBAL_THEME.text),
  success: colorField(DEFAULT_GLOBAL_THEME.success),
  warning: colorField(DEFAULT_GLOBAL_THEME.warning),
  danger: colorField(DEFAULT_GLOBAL_THEME.danger),
};

const customerThemeSchema = {
  primary: colorField(DEFAULT_CUSTOMER_THEME.primary),
  secondary: colorField(DEFAULT_CUSTOMER_THEME.secondary),
  accent: colorField(DEFAULT_CUSTOMER_THEME.accent),
  background: colorField(DEFAULT_CUSTOMER_THEME.background),
  text: colorField(DEFAULT_CUSTOMER_THEME.text),
  success: colorField(DEFAULT_CUSTOMER_THEME.success),
  warning: colorField(DEFAULT_CUSTOMER_THEME.warning),
  danger: colorField(DEFAULT_CUSTOMER_THEME.danger),
};

const ThemeSettingsSchema = new Schema<IThemeSettings>(
  {
    globalTheme: globalThemeSchema,
    customerTheme: customerThemeSchema,
    darkMode: {
      enabled: { type: Boolean, default: false },
      auto: { type: Boolean, default: false },
    },
    themeHistory: [
      {
        globalTheme: globalThemeSchema,
        customerTheme: customerThemeSchema,
        changedAt: { type: Date, default: Date.now },
        changedBy: { type: Schema.Types.ObjectId, ref: "Admin" },
      },
    ],
    scheduledTheme: {
      globalTheme: globalThemeSchema,
      customerTheme: customerThemeSchema,
      activateAt: { type: Date },
      active: { type: Boolean, default: false },
    },
    updatedBy: {
      type: Schema.Types.ObjectId,
      ref: "Admin",
    },
  },
  {
    timestamps: true,
  }
);

// Ensure only one theme settings document exists (singleton pattern)
ThemeSettingsSchema.statics.getSettings = async function () {
  let settings = await this.findOne();
  if (!settings) {
    settings = await this.create({
      globalTheme: DEFAULT_GLOBAL_THEME,
      customerTheme: DEFAULT_CUSTOMER_THEME,
    });
  }
  return settings;
};

// Cap history to 10 entries
ThemeSettingsSchema.pre("save", function (next) {
  if (this.themeHistory && this.themeHistory.length > 10) {
    this.themeHistory = this.themeHistory.slice(-10);
  }
  next();
});

const ThemeSettings = mongoose.model<IThemeSettings, IThemeSettingsModel>(
  "ThemeSettings",
  ThemeSettingsSchema
);

export default ThemeSettings;
