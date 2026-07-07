import { ReactNode } from "react";

type Accent = "amber" | "violet" | "emerald" | "sky" | "rose" | "indigo";

const accents: Record<
  Accent,
  { border: string; header: string; icon: string; badge: string }
> = {
  amber: {
    border: "border-amber-200",
    header: "from-amber-500 to-orange-500",
    icon: "bg-amber-100 text-amber-700",
    badge: "bg-amber-50 text-amber-700",
  },
  violet: {
    border: "border-violet-200",
    header: "from-violet-500 to-purple-600",
    icon: "bg-violet-100 text-violet-700",
    badge: "bg-violet-50 text-violet-700",
  },
  emerald: {
    border: "border-emerald-200",
    header: "from-emerald-500 to-teal-500",
    icon: "bg-emerald-100 text-emerald-700",
    badge: "bg-emerald-50 text-emerald-700",
  },
  sky: {
    border: "border-sky-200",
    header: "from-sky-500 to-blue-600",
    icon: "bg-sky-100 text-sky-700",
    badge: "bg-sky-50 text-sky-700",
  },
  rose: {
    border: "border-rose-200",
    header: "from-rose-500 to-pink-600",
    icon: "bg-rose-100 text-rose-700",
    badge: "bg-rose-50 text-rose-700",
  },
  indigo: {
    border: "border-indigo-200",
    header: "from-indigo-500 to-blue-600",
    icon: "bg-indigo-100 text-indigo-700",
    badge: "bg-indigo-50 text-indigo-700",
  },
};

interface FormSectionCardProps {
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  accent?: Accent;
  badge?: string;
  action?: ReactNode;
  children: ReactNode;
}

export default function FormSectionCard({
  title,
  subtitle,
  icon,
  accent = "sky",
  badge,
  action,
  children,
}: FormSectionCardProps) {
  const theme = accents[accent];

  return (
    <section
      className={`rounded-2xl border bg-white shadow-sm overflow-hidden ${theme.border}`}
    >
      <div className={`bg-gradient-to-r ${theme.header} px-5 py-4 text-white`}>
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3 min-w-0">
            {icon && (
              <div
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${theme.icon}`}
              >
                {icon}
              </div>
            )}
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-bold tracking-tight">{title}</h2>
                {badge && (
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${theme.badge}`}
                  >
                    {badge}
                  </span>
                )}
              </div>
              {subtitle && (
                <p className="mt-1 text-sm text-white/85">{subtitle}</p>
              )}
            </div>
          </div>
          {action}
        </div>
      </div>
      <div className="p-5 md:p-6">{children}</div>
    </section>
  );
}
