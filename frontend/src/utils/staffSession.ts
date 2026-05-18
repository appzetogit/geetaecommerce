export type StaffModule = "admin" | "seller";

export interface StaffMember {
  id: string;
  name: string;
  phone: string;
  role: string;
  commission: number;
  permissions?: string[];
}

export interface StaffSession {
  id: string;
  name: string;
  phone: string;
  role: string;
  commission: number;
  permissions: string[];
  module: StaffModule;
  loggedInAt: string;
}

export interface POSStaffBill {
  id: string;
  module: StaffModule;
  billNumber: string;
  orderId?: string;
  createdBy: string;
  staffName: string;
  paymentMode: string;
  totalAmount: number;
  numberOfProducts: number;
  createdAt: string;
  items: Array<{
    productName: string;
    qty: number;
    price: number;
  }>;
}

const getStaffListKey = (module: StaffModule) => `${module}_staff_list`;
const getStaffSessionKey = (module: StaffModule) => `${module}_staff_session`;
const getPOSStaffBillKey = (module: StaffModule) => `${module}_pos_staff_bills`;

const DEFAULT_STAFF_PERMISSIONS = ["pos", "orders", "customers"];

const UI_PERMISSION_PREFIX = "ui:";

const normalizePathForRoute = (path: string): string => {
  const [withoutQuery] = path.split("?");
  const [cleanPath] = withoutQuery.split("#");
  if (!cleanPath) return "/";
  return cleanPath.endsWith("/") && cleanPath.length > 1
    ? cleanPath.slice(0, -1)
    : cleanPath;
};

const normalizePathForPermissionId = (path: string): string => {
  const [withoutHash] = path.split("#");
  if (!withoutHash) return "/";
  return withoutHash.endsWith("/") && withoutHash.length > 1
    ? withoutHash.slice(0, -1)
    : withoutHash;
};

const buildPermissionIdFromPath = (module: StaffModule, path: string): string => {
  const normalizedPath = normalizePathForPermissionId(path);
  let adminPath = normalizedPath;

  if (module === "seller" && normalizedPath.startsWith("/seller")) {
    adminPath = `/admin${normalizedPath.slice("/seller".length)}`;
  }

  let normalized = adminPath.replace(/^\/admin\/?/, "");
  if (!normalized) normalized = "dashboard";

  const cleaned = normalized.replace(/[/?=&]/g, " ");
  const slug = cleaned
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");

  return `admin_${slug}`;
};

export const normalizeStaffMember = (staff: StaffMember): StaffMember => ({
  ...staff,
  permissions:
    Array.isArray(staff.permissions) && staff.permissions.length > 0
      ? staff.permissions
      : DEFAULT_STAFF_PERMISSIONS,
});

export const getStoredStaffList = (module: StaffModule): StaffMember[] => {
  try {
    const raw = localStorage.getItem(getStaffListKey(module));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((item) => normalizeStaffMember(item));
  } catch {
    return [];
  }
};

export const setStoredStaffList = (
  module: StaffModule,
  staffList: StaffMember[]
): void => {
  const normalized = staffList.map((item) => normalizeStaffMember(item));
  localStorage.setItem(getStaffListKey(module), JSON.stringify(normalized));
};

export const setStaffSession = (
  module: StaffModule,
  staff: StaffMember
): StaffSession => {
  const normalized = normalizeStaffMember(staff);
  const session: StaffSession = {
    id: normalized.id,
    name: normalized.name,
    phone: normalized.phone,
    role: normalized.role,
    commission: normalized.commission,
    permissions: normalized.permissions || DEFAULT_STAFF_PERMISSIONS,
    module,
    loggedInAt: new Date().toISOString(),
  };
  localStorage.setItem(getStaffSessionKey(module), JSON.stringify(session));
  return session;
};

export const getStaffSession = (module: StaffModule): StaffSession | null => {
  try {
    const raw = localStorage.getItem(getStaffSessionKey(module));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StaffSession;
    if (!parsed?.id || !parsed?.name) return null;
    return parsed;
  } catch {
    return null;
  }
};

export const clearStaffSession = (module: StaffModule): void => {
  localStorage.removeItem(getStaffSessionKey(module));
};

export const canStaffAccessPath = (
  module: StaffModule,
  path: string,
  permissions?: string[]
): boolean => {
  const allowedPermissions =
    permissions && permissions.length > 0 ? permissions : DEFAULT_STAFF_PERMISSIONS;
  const normalizedPath = normalizePathForRoute(path);
  const uiPermissions = allowedPermissions
    .filter((perm) => perm.startsWith(UI_PERMISSION_PREFIX))
    .map((perm) => perm.substring(UI_PERMISSION_PREFIX.length));
  const uiSet = new Set(uiPermissions);
  const hasUiPermissions = uiSet.size > 0;

  if (hasUiPermissions) {
    // Seller module aliases for admin permission keys pointing to seller routes.
    if (module === "seller") {
      if (
        normalizedPath.startsWith("/seller/account-settings") &&
        (uiSet.has("admin_settings_store") || uiSet.has("admin_delivery_settings"))
      ) {
        return true;
      }

      if (
        normalizedPath.startsWith("/seller/reports/payment") &&
        (uiSet.has("admin_payment_list") || uiSet.has("admin_reports_payment"))
      ) {
        return true;
      }
    }

    const directPermissionId = buildPermissionIdFromPath(module, path);
    if (uiSet.has(directPermissionId)) {
      return true;
    }

    // Parent menu should stay visible when any child route permission is enabled.
    const childPrefix = `${directPermissionId}_`;
    for (const permissionId of uiSet) {
      if (permissionId.startsWith(childPrefix)) {
        return true;
      }
    }

    // Keep POS access compatibility with existing toggle behavior, but restrict it to
    // the main POS page and customer helper routes so it doesn't broadly leak specific POS sub-pages
    // like reports, supplier ledger, and bill settings which have their own fine-grained permissions.
    if (uiSet.has("pos_access")) {
      const isBasePOS = normalizedPath === `/${module}/pos` || normalizedPath === `/${module}/pos/`;
      const isPOSCustomerHelper = normalizedPath.startsWith(`/${module}/pos/customers`);
      if (isBasePOS || isPOSCustomerHelper) {
        return true;
      }
    }

    // Since this staff member has fine-grained UI permissions configured,
    // we strictly return false if they did not match any of the above checks.
    // Do NOT fall back to legacy checking, which would bypass the fine-grained UI permissions!
    return false;
  }

  const posAllowed =
    allowedPermissions.includes("pos") &&
    (normalizedPath.startsWith(`/${module}/pos/orders`) ||
      normalizedPath.startsWith(`/${module}/pos/customers`) ||
      normalizedPath.startsWith(`/${module}/pos/customers/`));

  const ordersAllowed =
    allowedPermissions.includes("orders") &&
    (normalizedPath.startsWith(`/${module}/orders`) ||
      normalizedPath === `/${module}/orders`);

  const customersAllowed =
    allowedPermissions.includes("customers") &&
    (normalizedPath.startsWith(`/${module}/customers`) ||
      normalizedPath.startsWith(`/${module}/pos/customers`));

  return posAllowed || ordersAllowed || customersAllowed;
};

export const getPOSStaffBills = (module: StaffModule): POSStaffBill[] => {
  try {
    const raw = localStorage.getItem(getPOSStaffBillKey(module));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

export const appendPOSStaffBill = (
  module: StaffModule,
  bill: Omit<POSStaffBill, "id" | "module">
): POSStaffBill => {
  const existing = getPOSStaffBills(module);
  const payload: POSStaffBill = {
    ...bill,
    id: `staff_bill_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
    module,
  };
  localStorage.setItem(getPOSStaffBillKey(module), JSON.stringify([payload, ...existing]));
  return payload;
};

export const deletePOSStaffBills = (module: StaffModule, ids: string[]): void => {
  const idSet = new Set(ids);
  const existing = getPOSStaffBills(module);
  const next = existing.filter((bill) => !idSet.has(bill.id));
  localStorage.setItem(getPOSStaffBillKey(module), JSON.stringify(next));
};
