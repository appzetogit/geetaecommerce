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

  const posAllowed =
    allowedPermissions.includes("pos") &&
    (path.startsWith(`/${module}/pos/orders`) ||
      path.startsWith(`/${module}/pos/customers`) ||
      path.startsWith(`/${module}/pos/customers/`));

  const ordersAllowed =
    allowedPermissions.includes("orders") &&
    (path.startsWith(`/${module}/orders`) || path === `/${module}/orders`);

  const customersAllowed =
    allowedPermissions.includes("customers") &&
    (path.startsWith(`/${module}/customers`) || path.startsWith(`/${module}/pos/customers`));

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
