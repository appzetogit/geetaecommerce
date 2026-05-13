import { useState, useEffect, useCallback, useRef } from "react";
import { toast } from "react-hot-toast";
import {
  fetchFullThemeSettings,
  updateGlobalTheme,
  updateCustomerTheme,
  resetTheme,
  importTheme as importThemeAPI,
  restoreThemeFromHistory,
  type GlobalThemeData,
  type CustomerThemeData,
  type FullThemeResponse,
} from "../../../services/api/themeService";
import { checkContrast, getContrastBadgeColor } from "../../../utils/contrastChecker";
import { isValidHex, withAlpha, lighten, darken } from "../../../utils/colorUtils";

// ─── Theme Presets ───
const PRESETS: Record<string, { global: Partial<GlobalThemeData>; label: string; emoji: string }> = {
  blue: { label: "Blue", emoji: "🔵", global: { primary: "#2563eb", secondary: "#1e40af", accent: "#f59e0b", sidebar: "#1e293b", navbar: "#1e293b" } },
  green: { label: "Green", emoji: "🟢", global: { primary: "#059669", secondary: "#047857", accent: "#f59e0b", sidebar: "#064e3b", navbar: "#064e3b" } },
  purple: { label: "Purple", emoji: "🟣", global: { primary: "#7c3aed", secondary: "#6d28d9", accent: "#f59e0b", sidebar: "#2e1065", navbar: "#2e1065" } },
  orange: { label: "Orange", emoji: "🟠", global: { primary: "#ea580c", secondary: "#c2410c", accent: "#eab308", sidebar: "#431407", navbar: "#431407" } },
  dark: { label: "Dark", emoji: "⚫", global: { primary: "#6366f1", secondary: "#4f46e5", accent: "#f59e0b", sidebar: "#0f172a", navbar: "#0f172a", background: "#111827", text: "#f9fafb" } },
  luxury: { label: "Luxury Black", emoji: "✨", global: { primary: "#d4af37", secondary: "#b8860b", accent: "#f5f5dc", sidebar: "#0a0a0a", navbar: "#0a0a0a", background: "#1a1a1a", text: "#f5f5dc" } },
  red: { label: "Quick Commerce Red", emoji: "🔴", global: { primary: "#dc2626", secondary: "#b91c1c", accent: "#fbbf24", sidebar: "#450a0a", navbar: "#450a0a" } },
};

const DEFAULTS_GLOBAL: GlobalThemeData = { primary: "#2563eb", secondary: "#1e40af", accent: "#f59e0b", background: "#ffffff", sidebar: "#1e293b", navbar: "#1e293b", text: "#111827", success: "#10b981", warning: "#f59e0b", danger: "#ef4444" };
const DEFAULTS_CUSTOMER: CustomerThemeData = { primary: "#ef4444", secondary: "#dc2626", accent: "#f97316", background: "#ffffff", text: "#111827", success: "#10b981", warning: "#f59e0b", danger: "#ef4444" };

type ColorField = { key: string; label: string; icon: string };
const GLOBAL_FIELDS: ColorField[] = [
  { key: "primary", label: "Primary", icon: "🎨" },
  { key: "secondary", label: "Secondary", icon: "🖌️" },
  { key: "accent", label: "Accent", icon: "⚡" },
  { key: "background", label: "Background", icon: "📄" },
  { key: "sidebar", label: "Sidebar", icon: "📋" },
  { key: "navbar", label: "Navbar", icon: "🔝" },
  { key: "text", label: "Text", icon: "✏️" },
  { key: "success", label: "Success", icon: "✅" },
  { key: "warning", label: "Warning", icon: "⚠️" },
  { key: "danger", label: "Danger", icon: "🚨" },
];
const CUSTOMER_FIELDS: ColorField[] = [
  { key: "primary", label: "Primary", icon: "🎨" },
  { key: "secondary", label: "Secondary", icon: "🖌️" },
  { key: "accent", label: "Accent", icon: "⚡" },
  { key: "background", label: "Background", icon: "📄" },
  { key: "text", label: "Text", icon: "✏️" },
  { key: "success", label: "Success", icon: "✅" },
  { key: "warning", label: "Warning", icon: "⚠️" },
  { key: "danger", label: "Danger", icon: "🚨" },
];

// ─── Color Picker Component ───
function ColorInput({ label, icon, value, onChange }: { label: string; icon: string; value: string; onChange: (v: string) => void }) {
  const contrast = checkContrast(value, "#ffffff");
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", background: "#f8fafc", borderRadius: 10, border: "1px solid #e2e8f0" }}>
      <label style={{ position: "relative", cursor: "pointer", flexShrink: 0 }}>
        <div style={{ width: 40, height: 40, borderRadius: 8, background: value, border: "2px solid #cbd5e1", boxShadow: `0 2px 8px ${withAlpha(value, 0.3)}` }} />
        <input type="color" value={value} onChange={(e) => onChange(e.target.value)} style={{ position: "absolute", inset: 0, opacity: 0, cursor: "pointer", width: "100%", height: "100%" }} />
      </label>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "#334155" }}>{icon} {label}</div>
        <input type="text" value={value} onChange={(e) => { if (isValidHex(e.target.value) || e.target.value.length <= 7) onChange(e.target.value); }}
          style={{ fontSize: 12, fontFamily: "monospace", color: "#64748b", background: "transparent", border: "none", outline: "none", padding: 0, width: "100%" }}
        />
      </div>
      <div style={{ width: 8, height: 8, borderRadius: "50%", background: getContrastBadgeColor(contrast.score), flexShrink: 0 }} title={contrast.message} />
    </div>
  );
}

// ─── Preview Components ───
function PreviewPanel({ theme, label }: { theme: GlobalThemeData | CustomerThemeData; label: string }) {
  const isGlobal = "sidebar" in theme;
  return (
    <div style={{ background: theme.background, borderRadius: 12, overflow: "hidden", border: "1px solid #e2e8f0", minHeight: 300 }}>
      {/* Navbar */}
      <div style={{ background: isGlobal ? (theme as GlobalThemeData).navbar : theme.primary, padding: "12px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ color: "#fff", fontWeight: 700, fontSize: 14 }}>{label}</span>
        <div style={{ display: "flex", gap: 6 }}>{[1,2,3].map(i => <div key={i} style={{ width: 8, height: 8, borderRadius: "50%", background: "rgba(255,255,255,0.5)" }} />)}</div>
      </div>
      <div style={{ display: "flex", flex: 1 }}>
        {/* Sidebar */}
        {isGlobal && (
          <div style={{ width: 48, background: (theme as GlobalThemeData).sidebar, padding: "12px 0", display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
            {[1,2,3,4].map(i => <div key={i} style={{ width: 24, height: 24, borderRadius: 6, background: "rgba(255,255,255,0.15)" }} />)}
          </div>
        )}
        {/* Content */}
        <div style={{ flex: 1, padding: 14, display: "flex", flexDirection: "column", gap: 10 }}>
          {/* Buttons */}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button style={{ background: theme.primary, color: "#fff", border: "none", borderRadius: 6, padding: "6px 14px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Primary</button>
            <button style={{ background: theme.secondary, color: "#fff", border: "none", borderRadius: 6, padding: "6px 14px", fontSize: 12, fontWeight: 600 }}>Secondary</button>
            <button style={{ background: "transparent", color: theme.primary, border: `1.5px solid ${theme.primary}`, borderRadius: 6, padding: "6px 14px", fontSize: 12, fontWeight: 600 }}>Outline</button>
          </div>
          {/* Card */}
          <div style={{ background: "#fff", borderRadius: 8, padding: 12, border: "1px solid #e2e8f0" }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: theme.text, marginBottom: 4 }}>Sample Card</div>
            <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 8 }}>This is preview content with theme colors.</div>
            <div style={{ display: "flex", gap: 6 }}>
              <span style={{ background: withAlpha(theme.success, 0.15), color: theme.success, fontSize: 10, padding: "2px 8px", borderRadius: 99, fontWeight: 600 }}>Active</span>
              <span style={{ background: withAlpha(theme.warning, 0.15), color: theme.warning, fontSize: 10, padding: "2px 8px", borderRadius: 99, fontWeight: 600 }}>Pending</span>
              <span style={{ background: withAlpha(theme.danger, 0.15), color: theme.danger, fontSize: 10, padding: "2px 8px", borderRadius: 99, fontWeight: 600 }}>Error</span>
            </div>
          </div>
          {/* Input */}
          <div style={{ position: "relative" }}>
            <input disabled placeholder="Search..." style={{ width: "100%", padding: "8px 12px", borderRadius: 6, border: `1.5px solid ${withAlpha(theme.primary, 0.3)}`, fontSize: 12, background: "#fff", boxSizing: "border-box", outline: "none" }} />
          </div>
          {/* Accent bar */}
          <div style={{ height: 4, borderRadius: 2, background: `linear-gradient(90deg, ${theme.primary}, ${theme.accent})` }} />
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ───
export default function AdminThemeSettings() {
  const [globalDraft, setGlobalDraft] = useState<GlobalThemeData>(DEFAULTS_GLOBAL);
  const [customerDraft, setCustomerDraft] = useState<CustomerThemeData>(DEFAULTS_CUSTOMER);
  const [saved, setSaved] = useState<FullThemeResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"global" | "customer">("global");
  const [showHistory, setShowHistory] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadTheme = useCallback(async () => {
    try {
      setLoading(true);
      const data = await fetchFullThemeSettings();
      setSaved(data);
      setGlobalDraft(data.globalTheme);
      setCustomerDraft(data.customerTheme);
    } catch (err) {
      toast.error("Failed to load theme settings");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadTheme(); }, [loadTheme]);

  const handleSaveGlobal = async () => {
    setSaving("global");
    try {
      await updateGlobalTheme(globalDraft);
      toast.success("Global theme saved!");
      loadTheme();
    } catch { toast.error("Failed to save global theme"); }
    finally { setSaving(null); }
  };

  const handleSaveCustomer = async () => {
    setSaving("customer");
    try {
      await updateCustomerTheme(customerDraft);
      toast.success("Customer theme saved!");
      loadTheme();
    } catch { toast.error("Failed to save customer theme"); }
    finally { setSaving(null); }
  };

  const handleReset = async () => {
    if (!confirm("Reset both themes to defaults?")) return;
    setSaving("reset");
    try {
      await resetTheme();
      toast.success("Themes reset to defaults");
      loadTheme();
    } catch { toast.error("Failed to reset"); }
    finally { setSaving(null); }
  };

  const handleExport = () => {
    const data = JSON.stringify({ globalTheme: globalDraft, customerTheme: customerDraft }, null, 2);
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `theme-export-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Theme exported!");
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const json = JSON.parse(ev.target?.result as string);
        setSaving("import");
        await importThemeAPI(json);
        toast.success("Theme imported!");
        loadTheme();
      } catch { toast.error("Invalid theme file"); }
      finally { setSaving(null); }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const handleRestore = async (index: number) => {
    setSaving("restore");
    try {
      await restoreThemeFromHistory(index);
      toast.success("Theme restored from history");
      setShowHistory(false);
      loadTheme();
    } catch { toast.error("Failed to restore"); }
    finally { setSaving(null); }
  };

  const applyPreset = (key: string) => {
    const preset = PRESETS[key];
    if (!preset) return;
    setGlobalDraft((prev) => ({ ...prev, ...DEFAULTS_GLOBAL, ...preset.global }));
    toast.success(`Applied ${preset.label} preset — save to apply`);
  };

  if (loading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: 400 }}>
        <div style={{ width: 40, height: 40, border: "3px solid #e2e8f0", borderTopColor: "#2563eb", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", padding: "24px 16px" }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, color: "#0f172a", margin: 0 }}>🎨 Theme Settings</h1>
        <p style={{ color: "#64748b", fontSize: 14, margin: "4px 0 0" }}>Customize platform branding and customer app appearance</p>
      </div>

      {/* Toolbar */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 20 }}>
        <button onClick={handleReset} disabled={!!saving} style={{ background: "#fee2e2", color: "#dc2626", border: "none", borderRadius: 8, padding: "8px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
          {saving === "reset" ? "Resetting..." : "🔄 Reset All"}
        </button>
        <button onClick={handleExport} style={{ background: "#e0f2fe", color: "#0284c7", border: "none", borderRadius: 8, padding: "8px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>📥 Export</button>
        <button onClick={() => fileInputRef.current?.click()} disabled={!!saving} style={{ background: "#f0fdf4", color: "#16a34a", border: "none", borderRadius: 8, padding: "8px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
          {saving === "import" ? "Importing..." : "📤 Import"}
        </button>
        <input ref={fileInputRef} type="file" accept=".json" onChange={handleImport} style={{ display: "none" }} />
        <button onClick={() => setShowHistory(!showHistory)} style={{ background: "#fef3c7", color: "#d97706", border: "none", borderRadius: 8, padding: "8px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
          📜 History ({saved?.themeHistory?.length || 0})
        </button>
      </div>

      {/* History Panel */}
      {showHistory && saved?.themeHistory && saved.themeHistory.length > 0 && (
        <div style={{ background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 12, padding: 16, marginBottom: 20 }}>
          <h3 style={{ margin: "0 0 12px", fontSize: 15, fontWeight: 700, color: "#92400e" }}>Theme History (Last {saved.themeHistory.length})</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {saved.themeHistory.map((entry, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "#fff", padding: "8px 12px", borderRadius: 8, border: "1px solid #fde68a" }}>
                <div style={{ display: "flex", gap: 4 }}>
                  {Object.values(entry.globalTheme).slice(0, 5).map((c, j) => (
                    <div key={j} style={{ width: 16, height: 16, borderRadius: 4, background: typeof c === "string" ? c : "#ccc", border: "1px solid rgba(0,0,0,0.1)" }} />
                  ))}
                </div>
                <span style={{ fontSize: 11, color: "#92400e" }}>{new Date(entry.changedAt).toLocaleString()}</span>
                <button onClick={() => handleRestore(i)} disabled={!!saving} style={{ background: "#fbbf24", color: "#78350f", border: "none", borderRadius: 6, padding: "4px 12px", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
                  Restore
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: "flex", gap: 4, marginBottom: 20, background: "#f1f5f9", borderRadius: 10, padding: 4 }}>
        {(["global", "customer"] as const).map((tab) => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            style={{ flex: 1, padding: "10px 16px", borderRadius: 8, border: "none", fontWeight: 600, fontSize: 14, cursor: "pointer", transition: "all 0.2s",
              background: activeTab === tab ? "#fff" : "transparent",
              color: activeTab === tab ? "#0f172a" : "#64748b",
              boxShadow: activeTab === tab ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
            }}>
            {tab === "global" ? "🌐 Global Platform Theme" : "👤 Customer App Theme"}
          </button>
        ))}
      </div>

      {/* Content Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
        {/* Left: Color Pickers */}
        <div>
          {activeTab === "global" ? (
            <>
              {/* Presets */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#475569", marginBottom: 8 }}>Quick Presets</div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {Object.entries(PRESETS).map(([key, preset]) => (
                    <button key={key} onClick={() => applyPreset(key)}
                      style={{ background: preset.global.primary, color: "#fff", border: "none", borderRadius: 8, padding: "6px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer", transition: "transform 0.15s" }}
                      onMouseEnter={(e) => (e.currentTarget.style.transform = "scale(1.05)")}
                      onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}>
                      {preset.emoji} {preset.label}
                    </button>
                  ))}
                </div>
              </div>
              {/* Global Fields */}
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {GLOBAL_FIELDS.map((f) => (
                  <ColorInput key={f.key} label={f.label} icon={f.icon} value={(globalDraft as any)[f.key]}
                    onChange={(v) => setGlobalDraft((p) => ({ ...p, [f.key]: v }))} />
                ))}
              </div>
              <button onClick={handleSaveGlobal} disabled={!!saving}
                style={{ marginTop: 16, width: "100%", background: globalDraft.primary, color: "#fff", border: "none", borderRadius: 10, padding: "12px 0", fontSize: 15, fontWeight: 700, cursor: "pointer", transition: "opacity 0.2s", opacity: saving ? 0.6 : 1 }}>
                {saving === "global" ? "Saving..." : "💾 Save Global Theme"}
              </button>
            </>
          ) : (
            <>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {CUSTOMER_FIELDS.map((f) => (
                  <ColorInput key={f.key} label={f.label} icon={f.icon} value={(customerDraft as any)[f.key]}
                    onChange={(v) => setCustomerDraft((p) => ({ ...p, [f.key]: v }))} />
                ))}
              </div>
              <button onClick={handleSaveCustomer} disabled={!!saving}
                style={{ marginTop: 16, width: "100%", background: customerDraft.primary, color: "#fff", border: "none", borderRadius: 10, padding: "12px 0", fontSize: 15, fontWeight: 700, cursor: "pointer", transition: "opacity 0.2s", opacity: saving ? 0.6 : 1 }}>
                {saving === "customer" ? "Saving..." : "💾 Save Customer Theme"}
              </button>
            </>
          )}
        </div>

        {/* Right: Live Preview */}
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: "#475569", marginBottom: 8 }}>Live Preview</div>
          <PreviewPanel
            theme={activeTab === "global" ? globalDraft : customerDraft}
            label={activeTab === "global" ? "Admin Panel" : "Customer App"}
          />
          {/* Contrast Info */}
          <div style={{ marginTop: 12, padding: 12, background: "#f8fafc", borderRadius: 10, border: "1px solid #e2e8f0" }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: "#475569", marginBottom: 6 }}>Accessibility</div>
            {(() => {
              const t = activeTab === "global" ? globalDraft : customerDraft;
              const c = checkContrast(t.text, t.background);
              return (
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ width: 10, height: 10, borderRadius: "50%", background: getContrastBadgeColor(c.score) }} />
                  <span style={{ fontSize: 12, color: "#64748b" }}>Text/Background: {c.ratio}:1 — {c.message}</span>
                </div>
              );
            })()}
          </div>
        </div>
      </div>
    </div>
  );
}
