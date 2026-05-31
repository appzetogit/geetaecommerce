import React, { useEffect, useState } from 'react';
import { X, Shield, ChevronDown, ChevronUp, Save, ShoppingCart, Users, BarChart } from 'lucide-react';
import { Staff, RoleType } from '../pages/AdminManageStaff';
import { toast } from 'react-hot-toast';
import { useLocation } from 'react-router-dom';
import { getStoredStaffList, setStoredStaffList, StaffModule, getStaffSession, setStaffSession } from '../../../utils/staffSession';
import { updateStaff as apiUpdateStaff } from '../../../services/api/admin/adminStaffService';
import { getRoles as apiGetRoles, updateRole as apiUpdateRole } from '../../../services/api/admin/adminRoleService';

interface StaffRolePermissionsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  staff: Staff | null;
  roles: string[];
}

interface PermissionGroup {
  id: string;
  title: string;
  badge: string;
  badgeColor: string;
  permissions: {
    id: string;
    label: string;
    enabled: boolean;
  }[];
}

const BASE_PERMISSION_GROUPS: PermissionGroup[] = [
  {
    id: 'access',
    title: 'POS Access',
    badge: 'ACCESS CONTROL',
    badgeColor: 'text-[var(--primary-dark)] bg-[var(--primary-alpha-10)]',
    permissions: [
      { id: 'pos_access', label: 'Allow POS Module', enabled: true },
    ]
  },
  {
    id: 'inventory',
    title: 'Inventory',
    badge: 'PART ACCESS',
    badgeColor: 'text-orange-500 bg-orange-50',
    permissions: [
      { id: 'product_list', label: 'Product List', enabled: true },
      { id: 'add_product', label: 'Add Product', enabled: true },
      { id: 'edit_product', label: 'Edit Product', enabled: false },
      { id: 'category', label: 'Category', enabled: true },
      { id: 'header_category', label: 'Header Category', enabled: true },
      { id: 'subcategory', label: 'Sub Category', enabled: true },
      { id: 'brand', label: 'Brand', enabled: true },
      { id: 'attribute_setup', label: 'Attribute Setup', enabled: true },
      { id: 'variation_setup', label: 'Variation Setup', enabled: true },
      { id: 'taxes', label: 'Taxes', enabled: true },
      { id: 'barcode_settings', label: 'Barcode Settings', enabled: false },
      { id: 'product_display_settings', label: 'Product Display Settings', enabled: false },
    ]
  },
  {
    id: 'orders',
    title: 'Orders',
    badge: 'PART ACCESS',
    badgeColor: 'text-orange-500 bg-orange-50',
    permissions: [
      { id: 'all_orders', label: 'All Orders', enabled: true },
      { id: 'pending_orders', label: 'Pending Orders', enabled: true },
      { id: 'confirmed_orders', label: 'Confirmed Orders', enabled: true },
      { id: 'processed_orders', label: 'Processed Orders', enabled: true },
      { id: 'shipped_orders', label: 'Shipped Orders', enabled: true },
      { id: 'out_for_delivery', label: 'Out for Delivery', enabled: true },
      { id: 'delivered_orders', label: 'Delivered Orders', enabled: true },
      { id: 'cancelled_orders', label: 'Cancelled Orders', enabled: true },
      { id: 'pos_orders', label: 'POS Orders', enabled: true },
      { id: 'return_requests', label: 'Return Requests', enabled: true },
      { id: 'replace_requests', label: 'Replace Requests', enabled: true },
      { id: 'order_details', label: 'Order Details View', enabled: true },
    ]
  },
  {
    id: 'customers',
    title: 'Customers',
    badge: 'PART ACCESS',
    badgeColor: 'text-orange-500 bg-orange-50',
    permissions: [
      { id: 'my_customers', label: 'My Customers', enabled: true },
      { id: 'add_customer', label: 'Add Customer', enabled: true },
      { id: 'edit_customer', label: 'Edit Customer', enabled: false },
      { id: 'delete_customer', label: 'Delete Customer', enabled: false },
      { id: 'delete_ledger', label: 'Delete Ledger', enabled: false },
    ]
  },
  {
    id: 'online_orders',
    title: 'Online Orders',
    badge: 'PART ACCESS',
    badgeColor: 'text-orange-500 bg-orange-50',
    permissions: [
      { id: 'review_online_order', label: 'Review Online Order', enabled: true },
      { id: 'reject_online_order', label: 'Reject Online Order', enabled: false },
      { id: 'online_shop_edit', label: 'Online Shop Edit', enabled: false },
    ]
  },
  {
    id: 'reports',
    title: 'Reports',
    badge: 'PART ACCESS',
    badgeColor: 'text-orange-500 bg-orange-50',
    permissions: [
      { id: 'sales_summary', label: 'Sales Summary', enabled: false },
      { id: 'return_exchange_summary', label: 'Return/Exchange Summary', enabled: false },
      { id: 'stock_sales_summary', label: 'Stock Sales Summary', enabled: false },
      { id: 'due_summary', label: 'Due Summary', enabled: false },
      { id: 'stock_summary', label: 'Stock Summary', enabled: false },
      { id: 'stock_balance_summary', label: 'Stock Balance Summary', enabled: false },
      { id: 'low_stock_summary', label: 'Low Stock Summary', enabled: true },
      { id: 'out_of_stock_summary', label: 'Out of Stock Summary', enabled: true },
      { id: 'loss_summary', label: 'Loss Summary', enabled: false },
      { id: 'gst_sales', label: 'GST Sales', enabled: false },
      { id: 'gst_register', label: 'Custom GST Report', enabled: false },
      { id: 'payment_report', label: 'Payment Report', enabled: false },
      { id: 'online_order_report', label: 'Online Order Report', enabled: false },
      { id: 'pos_invoice_report', label: 'POS Invoice Report', enabled: false },
    ]
  }
];

const ADMIN_SIDEBAR_SECTIONS: Array<{
  title: string;
  badge: string;
  badgeColor: string;
  items: Array<{ label: string; path: string; defaultEnabled?: boolean }>;
}> = [
  {
    title: 'Main',
    badge: 'CORE',
    badgeColor: 'text-slate-600 bg-slate-50',
    items: [
      { label: 'Dashboard', path: '/admin' },
      { label: 'Sales & Summary', path: '/admin/sales-summary' },
    ],
  },
  {
    title: 'POS Section',
    badge: 'POS MENU',
    badgeColor: 'text-[var(--primary-dark)] bg-[var(--primary-alpha-10)]',
    items: [
      { label: 'POS Orders', path: '/admin/pos/orders' },
      { label: 'POS Report', path: '/admin/pos/report' },
      { label: 'Purchase Report', path: '/admin/purchase/report' },
      { label: 'POS Quotations', path: '/admin/pos/quotations' },
      { label: 'Supplier Ledger', path: '/admin/pos/suppliers' },
      { label: 'POS Bill Settings', path: '/admin/pos/bill-settings' },
    ],
  },
  {
    title: 'Reports',
    badge: 'REPORTS',
    badgeColor: 'text-[var(--primary-dark)] bg-[var(--primary-alpha-10)]',
    items: [
      { label: 'Reports', path: '/admin/reports' },
      { label: 'Order Report', path: '/admin/reports/order' },
      { label: 'Invoice Report', path: '/admin/reports/invoice' },
      { label: 'Product Inventory Report', path: '/admin/reports/inventory' },
      { label: 'Stock Summary', path: '/admin/reports/inventory/stock-summary' },
      { label: 'Stock Balance summary', path: '/admin/reports/inventory/stock-balance' },
      { label: 'Low Stock summary', path: '/admin/reports/inventory/low-stock' },
      { label: 'Out of stock summary', path: '/admin/reports/inventory/out-of-stock' },
      { label: 'Loss summary', path: '/admin/reports/inventory/loss-summary' },
      { label: 'GST Sales Report', path: '/admin/reports/gst-sales' },
      { label: 'Custom GST Report', path: '/admin/reports/gst-register' },
      { label: 'Payment Report', path: '/admin/reports/payment' },
      { label: 'Sales Reports', path: '/admin/reports/sales' },
      { label: 'Sales Summary', path: '/admin/reports/sales/summary' },
      { label: 'Return and Exchange summary', path: '/admin/reports/sales/return-exchange' },
      { label: 'Stock Sales Summary', path: '/admin/reports/sales/stock-sales' },
      { label: 'Due Summary', path: '/admin/reports/sales/due-summary' },
    ],
  },
  {
    title: 'Product Section',
    badge: 'PRODUCT',
    badgeColor: 'text-orange-600 bg-orange-50',
    items: [
      { label: 'Category', path: '/admin/category' },
      { label: 'Header Category', path: '/admin/category/header' },
      { label: 'Brand', path: '/admin/brand' },
      { label: 'Product', path: '/admin/product' },
      { label: 'Product List', path: '/admin/product/list' },
      { label: 'Taxes', path: '/admin/product/taxes' },
      { label: 'Attribute Setup', path: '/admin/product/attribute-setup' },
      { label: 'Variation Setup', path: '/admin/product/variation-setup' },
      { label: 'Manage Seller', path: '/admin/manage-seller' },
      { label: 'Add Seller', path: '/admin/manage-seller/add' },
      { label: 'Manage Seller List', path: '/admin/manage-seller/list' },
      { label: 'Seller Transaction', path: '/admin/manage-seller/transaction' },
      { label: 'Seller User Limit', path: '/admin/manage-seller/user-limit' },
    ],
  },
  {
    title: 'Customer Section',
    badge: 'CUSTOMER',
    badgeColor: 'text-emerald-600 bg-emerald-50',
    items: [
      { label: 'Abandoned Carts', path: '/admin/customers/abandoned-carts' },
    ],
  },
  {
    title: 'Delivery Section',
    badge: 'DELIVERY',
    badgeColor: 'text-cyan-600 bg-cyan-50',
    items: [
      { label: 'Manage Location', path: '/admin/manage-location' },
      { label: 'Seller Location', path: '/admin/manage-location/seller-location' },
      { label: 'Delivery Boy', path: '/admin/delivery-boy' },
      { label: 'Add Delivery Boy', path: '/admin/delivery-boy/add' },
      { label: 'Manage Delivery Boy', path: '/admin/delivery-boy/manage' },
      { label: 'Fund Transfer', path: '/admin/delivery-boy/fund-transfer' },
      { label: 'Cash Collection', path: '/admin/delivery-boy/cash-collection' },
    ],
  },
  {
    title: 'Miscellaneous',
    badge: 'MISC',
    badgeColor: 'text-slate-600 bg-slate-50',
    items: [
      { label: 'Wallet', path: '/admin/wallet' },
      { label: 'Users', path: '/admin/users' },
      { label: 'Notification', path: '/admin/notification' },
      { label: 'FAQ', path: '/admin/faq' },
    ],
  },
  {
    title: 'Order Section',
    badge: 'ORDERS',
    badgeColor: 'text-amber-600 bg-amber-50',
    items: [
      { label: 'Order List', path: '/admin/orders' },
      { label: 'All Order', path: '/admin/orders/all' },
      { label: 'Pending Order', path: '/admin/orders/pending' },
      { label: 'Received Order', path: '/admin/orders/received' },
      { label: 'Processed Order', path: '/admin/orders/processed' },
      { label: 'Shipped Order', path: '/admin/orders/shipped' },
      { label: 'Out For Delivery', path: '/admin/orders/out-for-delivery' },
      { label: 'Delivered Order', path: '/admin/orders/delivered' },
      { label: 'Cancelled Order', path: '/admin/orders/cancelled' },
    ],
  },
  {
    title: 'Requests',
    badge: 'REQUESTS',
    badgeColor: 'text-rose-600 bg-rose-50',
    items: [
      { label: 'Return Requests', path: '/admin/return-requests' },
      { label: 'Replace Requests', path: '/admin/replace-requests' },
    ],
  },
  {
    title: 'Promotion',
    badge: 'PROMO',
    badgeColor: 'text-pink-600 bg-pink-50',
    items: [
      { label: 'Banner Setup', path: '/admin/promotion/banner-setup' },
      { label: 'Free Gift Rules', path: '/admin/promotion/free-gift-rules' },
      { label: 'Offers & Deals', path: '/admin/promotion/offers-deals' },
      { label: 'Coupon', path: '/admin/coupon' },
      { label: 'Flash Deals', path: '/admin/promotion/flash-deals' },
      { label: 'Deal of the day', path: '/admin/promotion/deal-of-the-day' },
      { label: 'Featured Deal', path: '/admin/promotion/featured-deal' },
      { label: 'Home Section', path: '/admin/home-section' },
      { label: 'Bestseller Cards', path: '/admin/bestseller-cards' },
      { label: 'Promo Strip', path: '/admin/promo-strip' },
      { label: 'Lowest Prices', path: '/admin/lowest-prices' },
      { label: 'Shop by Store', path: '/admin/shop-by-store' },
      { label: 'Video Finds', path: '/admin/video-finds' },
    ],
  },
  {
    title: '3rd Party',
    badge: 'INTEGRATION',
    badgeColor: 'text-violet-600 bg-violet-50',
    items: [
      { label: 'Payment methods', path: '/admin/payment-list' },
      { label: 'Other Configurations', path: '/admin/app-settings' },
      { label: 'Shiprocket Integration', path: '/admin/app-settings?tab=shiprocket' },
    ],
  },
  {
    title: 'Setting',
    badge: 'SETTINGS',
    badgeColor: 'text-gray-600 bg-gray-50',
    items: [
      { label: 'Brand Settings', path: '/admin/settings/store' },
      { label: 'Product Settings', path: '/admin/product-display-settings' },
      { label: 'Barcode Settings', path: '/admin/barcode-settings' },
      { label: 'Delivery Settings', path: '/admin/delivery-settings' },
      { label: 'Payment List', path: '/admin/payment-list' },
      { label: 'SMS Gateway', path: '/admin/sms-gateway' },
      { label: 'System User', path: '/admin/system-user' },
      { label: 'Customer App Policy', path: '/admin/customer-app-policy' },
      { label: 'Delivery App Policy', path: '/admin/delivery-app-policy' },
    ],
  },
];

const buildGroupId = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');

const buildPermissionIdFromPath = (path: string) => {
  let normalized = path.replace(/^\/admin\/?/, '');
  if (!normalized) {
    normalized = 'dashboard';
  }
  const cleaned = normalized.replace(/[/?=&]/g, ' ');
  const slug = cleaned
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
  return `admin_${slug}`;
};

const buildAdminPermissionGroups = (): PermissionGroup[] => {
  const accessGroup = BASE_PERMISSION_GROUPS.find((group) => group.id === 'access');
  const sidebarGroups = ADMIN_SIDEBAR_SECTIONS.map((section) => {
    const seenPaths = new Set<string>();
    const permissions = section.items
      .filter((item) => {
        if (seenPaths.has(item.path)) return false;
        seenPaths.add(item.path);
        return true;
      })
      .map((item) => ({
        id: buildPermissionIdFromPath(item.path),
        label: item.label,
        enabled: item.defaultEnabled ?? false,
      }));

    return {
      id: buildGroupId(section.title),
      title: section.title,
      badge: section.badge,
      badgeColor: section.badgeColor,
      permissions,
    };
  });

  return accessGroup ? [accessGroup, ...sidebarGroups] : sidebarGroups;
};

const SELLER_SIDEBAR_SECTIONS: Array<{
  title: string;
  badge: string;
  badgeColor: string;
  items: Array<{ label: string; path: string; defaultEnabled?: boolean }>;
}> = [
  {
    title: 'Main',
    badge: 'CORE',
    badgeColor: 'text-slate-600 bg-slate-50',
    items: [
      { label: 'Dashboard', path: '/seller' },
    ],
  },
  {
    title: 'Orders',
    badge: 'ORDERS',
    badgeColor: 'text-amber-600 bg-amber-50',
    items: [
      { label: 'Orders', path: '/seller/orders' },
      { label: 'All', path: '/seller/orders/all' },
      { label: 'Pending', path: '/seller/orders/pending' },
      { label: 'Received', path: '/seller/orders/received' },
      { label: 'Processed', path: '/seller/orders/processed' },
      { label: 'Shipped', path: '/seller/orders/shipped' },
      { label: 'Out For Delivery', path: '/seller/orders/out-for-delivery' },
      { label: 'Delivered', path: '/seller/orders/delivered' },
      { label: 'Cancelled', path: '/seller/orders/cancelled' },
    ],
  },
  {
    title: 'Requests',
    badge: 'REQUESTS',
    badgeColor: 'text-rose-600 bg-rose-50',
    items: [
      { label: 'Requests', path: '/seller/requests' },
      { label: 'Return Requests', path: '/seller/return-requests' },
      { label: 'Replace Requests', path: '/seller/replace-requests' },
    ],
  },
  {
    title: 'POS System',
    badge: 'POS',
    badgeColor: 'text-[var(--primary-dark)] bg-[var(--primary-alpha-10)]',
    items: [
      { label: 'POS System', path: '/seller/pos' },
      { label: 'POS Orders', path: '/seller/pos/orders' },
      { label: 'POS Report', path: '/seller/pos/report' },
      { label: 'Purchase Report', path: '/seller/purchase/report' },
      { label: 'POS Quotations', path: '/seller/pos/quotations' },
      { label: 'Supplier Ledger', path: '/seller/pos/suppliers' },
    ],
  },
  {
    title: 'Category',
    badge: 'CATEGORY',
    badgeColor: 'text-orange-600 bg-orange-50',
    items: [
      { label: 'Category', path: '/seller/category' },
      { label: 'SubCategory', path: '/seller/subcategory' },
    ],
  },
  {
    title: 'Products',
    badge: 'PRODUCT',
    badgeColor: 'text-orange-600 bg-orange-50',
    items: [
      { label: 'Attribute Setup', path: '/seller/product/attribute-setup' },
      { label: 'Variation Setup', path: '/seller/product/variation-setup' },
      { label: 'Product', path: '/seller/product' },
      { label: 'Add new Product', path: '/seller/product/add' },
      { label: 'Taxes', path: '/seller/product/taxes' },
      { label: 'Product List', path: '/seller/product/list' },
      { label: 'Stock Management', path: '/seller/product/stock' },
    ],
  },
  {
    title: 'Reports',
    badge: 'REPORTS',
    badgeColor: 'text-[var(--primary-dark)] bg-[var(--primary-alpha-10)]',
    items: [
      { label: 'Reports', path: '/seller/reports' },
      { label: 'Order Report', path: '/seller/reports/order' },
      { label: 'Invoice Report', path: '/seller/reports/invoice' },
      { label: 'GST Sales Report', path: '/seller/reports/gst-sales' },
      { label: 'Custom GST Report', path: '/seller/reports/gst-register' },
      { label: 'Payment Report', path: '/seller/reports/payment' },
      { label: 'Sales Reports', path: '/seller/reports/sales' },
      { label: 'Sales Summary', path: '/seller/reports/sales/summary' },
      { label: 'Return and Exchange summary', path: '/seller/reports/sales/return-exchange' },
      { label: 'Stock Sales Summary', path: '/seller/reports/sales/stock-sales' },
      { label: 'Due Summary', path: '/seller/reports/sales/due-summary' },
      { label: 'Product Inventory Reports', path: '/seller/inventory-reports' },
      { label: 'Stock Summary', path: '/seller/inventory-reports/stock-summary' },
      { label: 'Stock Balance', path: '/seller/inventory-reports/stock-balance' },
      { label: 'Low Stock', path: '/seller/inventory-reports/low-stock' },
      { label: 'Out of Stock', path: '/seller/inventory-reports/out-of-stock' },
      { label: 'Loss Summary', path: '/seller/inventory-reports/loss-summary' },
    ],
  },
  {
    title: 'Wallet',
    badge: 'WALLET',
    badgeColor: 'text-emerald-600 bg-emerald-50',
    items: [
      { label: 'Wallet', path: '/seller/wallet' },
      { label: 'Wallet Transactions', path: '/seller/wallet/transactions' },
      { label: 'Withdrawal Requests', path: '/seller/wallet/withdrawals' },
    ],
  },
  {
    title: 'Settings',
    badge: 'SETTINGS',
    badgeColor: 'text-gray-600 bg-gray-50',
    items: [
      { label: 'Product Settings', path: '/seller/product-display-settings' },
      { label: 'Bill Settings', path: '/seller/bill-settings' },
      { label: 'Barcode Settings', path: '/seller/barcode-settings' },
    ],
  },
];

const buildSellerPermissionGroups = (): PermissionGroup[] => {
  const accessGroup = BASE_PERMISSION_GROUPS.find((group) => group.id === 'access');
  const sidebarGroups = SELLER_SIDEBAR_SECTIONS.map((section) => {
    const seenPaths = new Set<string>();
    const permissions = section.items
      .filter((item) => {
        if (seenPaths.has(item.path)) return false;
        seenPaths.add(item.path);
        return true;
      })
      .map((item) => ({
        id: buildPermissionIdFromPath(item.path.replace('/seller', '/admin')),
        label: item.label,
        enabled: item.defaultEnabled ?? false,
      }));

    return {
      id: buildGroupId(section.title),
      title: section.title,
      badge: section.badge,
      badgeColor: section.badgeColor,
      permissions,
    };
  });

  return accessGroup ? [accessGroup, ...sidebarGroups] : sidebarGroups;
};

const SELLER_ALLOWED_PERMISSION_IDS = new Set([
  'pos_access',
  'product_list',
  'add_product',
  'edit_product',
  'category',
  'subcategory',
  'attribute_setup',
  'variation_setup',
  'taxes',
  'barcode_settings',
  'product_display_settings',
  'all_orders',
  'pending_orders',
  'confirmed_orders',
  'processed_orders',
  'shipped_orders',
  'out_for_delivery',
  'delivered_orders',
  'cancelled_orders',
  'pos_orders',
  'return_requests',
  'replace_requests',
  'order_details',
  'my_customers',
  'sales_summary',
  'return_exchange_summary',
  'stock_sales_summary',
  'due_summary',
  'stock_summary',
  'stock_balance_summary',
  'low_stock_summary',
  'out_of_stock_summary',
  'loss_summary',
  'gst_sales',
  'payment_report',
  'online_order_report'
]);

const StaffRolePermissionsPanel: React.FC<StaffRolePermissionsPanelProps> = ({ isOpen, onClose, staff, roles }) => {
  const location = useLocation();
  const isSellerManageStaff = location.pathname.startsWith('/seller/');
  const moduleType: StaffModule = isSellerManageStaff ? 'seller' : 'admin';
  const [selectedRole, setSelectedRole] = useState<string>(staff?.role || roles[0] || 'STAFF');
  const [expandedGroups, setExpandedGroups] = useState<string[]>(() =>
    isSellerManageStaff
      ? ['access', 'inventory', 'orders']
      : ['access', buildGroupId('POS Section'), buildGroupId('Reports')]
  );

  const [permissionGroups, setPermissionGroups] = useState<PermissionGroup[]>(() => {
    if (isSellerManageStaff) {
      return buildSellerPermissionGroups();
    }
    return buildAdminPermissionGroups();
  });

  // Whenever panel opens, selectedRole changes, or staff changes, sync toggles from stored permissions
  useEffect(() => {
    let effectivePermissions: string[] = ['pos', 'orders', 'customers'];
    const storedList = getStoredStaffList(moduleType);

    if (staff) {
      // Individual Staff Mode: Find freshest staff data from storage
      const storedMember = storedList.find(m => m.id === staff.id);
      effectivePermissions = storedMember?.permissions || staff.permissions || ['pos', 'orders', 'customers'];
    } else {
      // Global/Role Mode: Find any staff member with the selected role to load their permissions
      const normalizedTargetRole = selectedRole.trim().toUpperCase().replace(/_/g, '').replace(/\s+/g, '');
      const roleMember = storedList.find(m => {
        const memberRole = (m.role || '').trim().toUpperCase().replace(/_/g, '').replace(/\s+/g, '');
        return memberRole === normalizedTargetRole;
      });
      if (roleMember && Array.isArray(roleMember.permissions)) {
        effectivePermissions = roleMember.permissions;
      }
    }

    const hasPOSPermission = effectivePermissions.includes('pos');

    const UI_PREFIX = 'ui:';
    const enabledFromUi = new Set(
      effectivePermissions
        .filter((perm) => perm.startsWith(UI_PREFIX))
        .map((perm) => perm.substring(UI_PREFIX.length))
    );

    const baseGroups = isSellerManageStaff
      ? buildSellerPermissionGroups()
      : buildAdminPermissionGroups();

    const mapped = baseGroups.map(group => ({
      ...group,
      permissions: group.permissions.map(permission => {
        if (group.id === 'access' && permission.id === 'pos_access') {
          return { ...permission, enabled: hasPOSPermission };
        }
        // Use stored UI state if present, otherwise default from BASE_PERMISSION_GROUPS
        const uiEnabled = enabledFromUi.has(permission.id);
        return {
          ...permission,
          enabled: uiEnabled ? true : permission.enabled,
        };
      }),
    }));

    setPermissionGroups(mapped);
  }, [staff, selectedRole, moduleType, isSellerManageStaff]);

  const getPermissionEnabled = (groupId: string, permissionId: string): boolean => {
    const group = permissionGroups.find(g => g.id === groupId);
    const permission = group?.permissions.find(p => p.id === permissionId);
    return !!permission?.enabled;
  };

  const toggleGroup = (id: string) => {
    setExpandedGroups(prev =>
      prev.includes(id) ? prev.filter(g => g !== id) : [...prev, id]
    );
  };

  const togglePermission = (groupId: string, permissionId: string) => {
    setPermissionGroups(prev => prev.map(group => {
      if (group.id === groupId) {
        return {
          ...group,
          permissions: group.permissions.map(p =>
            p.id === permissionId ? { ...p, enabled: !p.enabled } : p
          )
        };
      }
      return group;
    }));
  };

  const handleSave = async () => {
    const staffList = getStoredStaffList(moduleType);

    // Collect all enabled permission IDs from UI
    const enabledPermissionIds = permissionGroups.flatMap((group) =>
      group.permissions.filter((p) => p.enabled).map((p) => p.id)
    );

    // POS access toggle still controls legacy "pos" permission (actual access check)
    const allowPOS = getPermissionEnabled('access', 'pos_access');
    const UI_PREFIX = 'ui:';

    if (staff) {
      // --- Individual Staff Mode ---
      const updatedStaffList = staffList.map((member) => {
        if (member.id !== staff.id) return member;

        const basePermissions =
          Array.isArray(member.permissions) && member.permissions.length > 0
          ? member.permissions
          : ['pos', 'orders', 'customers'];

        // Preserve existing base permissions, only adjust "pos"
        const baseSet = new Set(basePermissions);
        if (allowPOS) {
          baseSet.add('pos');
        } else {
          baseSet.delete('pos');
        }

        // Store UI-level permissions alongside, with a prefix so they don't
        // interfere with existing access checks (which only look for 'pos', 'orders', 'customers')
        const filteredBase = Array.from(baseSet).filter((perm) => !perm.startsWith(UI_PREFIX));
        const uiPermissions = enabledPermissionIds.map((id) => `${UI_PREFIX}${id}`);
        const nextPermissions = [...filteredBase, ...uiPermissions];

        return {
          ...member,
          permissions: nextPermissions,
        };
      });

      setStoredStaffList(moduleType, updatedStaffList);

      // Keep other module (admin <-> seller) in sync so that existing staff
      // sessions update without forcing logout/login.
      const otherModule: StaffModule = moduleType === 'admin' ? 'seller' : 'admin';
      const otherList = getStoredStaffList(otherModule);
      if (otherList.length > 0) {
        const sourceMember = updatedStaffList.find((m) => m.id === staff.id || m.phone === staff.phone);
        if (sourceMember) {
          const syncedOtherList = otherList.map((member) =>
            member.id === staff.id || member.phone === staff.phone
              ? {
                  ...member,
                  permissions: sourceMember.permissions,
                }
              : member
          );
          setStoredStaffList(otherModule, syncedOtherList);

          const otherSession = getStaffSession(otherModule);
          if (otherSession && (otherSession.id === staff.id || otherSession.phone === staff.phone)) {
            const refreshedOther = syncedOtherList.find(
              (member) => member.id === staff.id || member.phone === staff.phone
            );
            if (refreshedOther) {
              setStaffSession(otherModule, refreshedOther);
            }
          }
        }
      }

      const activeSession = getStaffSession(moduleType);
      if (activeSession && activeSession.id === staff.id) {
        const refreshedStaff = updatedStaffList.find((member) => member.id === staff.id);
        if (refreshedStaff) {
          setStaffSession(moduleType, refreshedStaff);
        }
      }

      // Persist permissions to backend Staff document (fire-and-forget style)
      try {
        const memberFromList = updatedStaffList.find((m) => m.id === staff.id);
        if (memberFromList) {
          await apiUpdateStaff(staff.id, {
            permissions: memberFromList.permissions,
          });
        }
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error('Failed to update staff permissions', error);
      }
    } else {
      // --- Global/Role-wide Mode ---
      const normalizedTargetRole = selectedRole.trim().toUpperCase().replace(/_/g, '').replace(/\s+/g, '');

      // 1. Update localStorage staff list for the current module
      const updatedStaffList = staffList.map((member) => {
        const memberRole = (member.role || '').trim().toUpperCase().replace(/_/g, '').replace(/\s+/g, '');
        if (memberRole !== normalizedTargetRole) return member;

        const basePermissions =
          Array.isArray(member.permissions) && member.permissions.length > 0
          ? member.permissions
          : ['pos', 'orders', 'customers'];

        const baseSet = new Set(basePermissions);
        if (allowPOS) {
          baseSet.add('pos');
        } else {
          baseSet.delete('pos');
        }

        const filteredBase = Array.from(baseSet).filter((perm) => !perm.startsWith(UI_PREFIX));
        const uiPermissions = enabledPermissionIds.map((id) => `${UI_PREFIX}${id}`);
        const nextPermissions = [...filteredBase, ...uiPermissions];

        return {
          ...member,
          permissions: nextPermissions,
        };
      });

      setStoredStaffList(moduleType, updatedStaffList);

      // 2. Keep the other module (admin <-> seller) in sync
      const otherModule: StaffModule = moduleType === 'admin' ? 'seller' : 'admin';
      const otherList = getStoredStaffList(otherModule);
      if (otherList.length > 0) {
        const syncedOtherList = otherList.map((member) => {
          const memberRole = (member.role || '').trim().toUpperCase().replace(/_/g, '').replace(/\s+/g, '');
          if (memberRole !== normalizedTargetRole) return member;

          const sourceMember = updatedStaffList.find(m => m.id === member.id || m.phone === member.phone);
          if (sourceMember) {
            return {
              ...member,
              permissions: sourceMember.permissions,
            };
          }
          return member;
        });
        setStoredStaffList(otherModule, syncedOtherList);

        // Update active other session if applicable
        const otherSession = getStaffSession(otherModule);
        if (otherSession) {
          const otherSessionRole = (otherSession.role || '').trim().toUpperCase().replace(/_/g, '').replace(/\s+/g, '');
          if (otherSessionRole === normalizedTargetRole) {
            const refreshedOther = syncedOtherList.find(
              (member) => member.id === otherSession.id || member.phone === otherSession.phone
            );
            if (refreshedOther) {
              setStaffSession(otherModule, refreshedOther);
            }
          }
        }
      }

      // 3. Update currently active local session if they match the role
      const activeSession = getStaffSession(moduleType);
      if (activeSession) {
        const activeSessionRole = (activeSession.role || '').trim().toUpperCase().replace(/_/g, '').replace(/\s+/g, '');
        if (activeSessionRole === normalizedTargetRole) {
          const refreshedStaff = updatedStaffList.find((member) => member.id === activeSession.id);
          if (refreshedStaff) {
            setStaffSession(moduleType, refreshedStaff);
          }
        }
      }

      // 4. Persist permissions for each matched staff member to the backend (fire-and-forget style)
      const targetMembers = updatedStaffList.filter((member) => {
        const memberRole = (member.role || '').trim().toUpperCase().replace(/_/g, '').replace(/\s+/g, '');
        return memberRole === normalizedTargetRole;
      });

      for (const member of targetMembers) {
        apiUpdateStaff(member.id, {
          permissions: member.permissions,
        }).catch((err) => {
          // eslint-disable-next-line no-console
          console.error(`Failed to update backend staff permissions for ${member.name}`, err);
        });
      }

      // 5. Update the global Role document itself in the Role collection (Admin module only)
      if (moduleType === 'admin') {
        apiGetRoles().then((rolesRes) => {
          if (rolesRes.success && Array.isArray(rolesRes.data)) {
            const matchedRoleDoc = rolesRes.data.find(
              (r) => r.name.trim().toUpperCase().replace(/_/g, '').replace(/\s+/g, '') === normalizedTargetRole
            );
            if (matchedRoleDoc) {
              const uiPermissions = enabledPermissionIds.map((id) => `${UI_PREFIX}${id}`);
              const legacyPermissions = allowPOS ? ['pos'] : [];
              apiUpdateRole(matchedRoleDoc._id, {
                permissions: [...legacyPermissions, ...uiPermissions],
              }).catch((err) => {
                // eslint-disable-next-line no-console
                console.error('Failed to update global role document permissions', err);
              });
            }
          }
        }).catch((err) => {
          // eslint-disable-next-line no-console
          console.error('Failed to fetch role definitions for global sync', err);
        });
      }
    }

    const roleStr = selectedRole.replace('_', ' ');
    const target = staff ? `staff ${staff.name}` : `all ${roleStr} members`;
    toast.success(`Permissions updated for ${target}`);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="w-full max-w-2xl bg-white h-[90vh] rounded-3xl shadow-2xl flex flex-col animate-in zoom-in-95 duration-300 overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-white sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[var(--primary-color)]/10 flex items-center justify-center text-[var(--primary-color)]">
              <Shield size={22} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-800">{staff ? 'Role Management' : 'Edit Roles & Permissions'}</h2>
              <p className="text-xs text-gray-500">
                {staff ? `Configure permissions for ${staff.name}` : 'Setup global permissions for selected role'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-8 pb-24">
          {/* Role Selector */}
          <div className="space-y-4 bg-gray-50/50 p-6 rounded-3xl border border-gray-100">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-white rounded-2xl shadow-sm border border-gray-100 flex items-center justify-center text-gray-400">
                <Shield size={24} />
              </div>
              <div className="flex-1">
                <h4 className="text-sm font-bold text-gray-800">Select Role</h4>
                <p className="text-xs text-gray-500 mb-3">Configure permissions for different user roles</p>
                <div className="relative">
                  <select
                    value={selectedRole}
                    onChange={(e) => setSelectedRole(e.target.value)}
                    className="w-full pl-4 pr-10 py-3 bg-white border border-gray-200 rounded-xl font-semibold text-gray-700 focus:outline-none focus:ring-2 focus:ring-[var(--primary-color)]/20 appearance-none cursor-pointer"
                  >
                    {roles.map(role => (
                      <option key={role} value={role}>{role.replace(/_/g, ' ')}</option>
                    ))}
                  </select>
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
                    <ChevronDown size={20} />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Permission Groups */}
          <div className="space-y-6">
            {permissionGroups.map((group) => (
              <div key={group.id} className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
                <button
                  onClick={() => toggleGroup(group.id)}
                  className="w-full p-6 flex items-center justify-between hover:bg-gray-50/50 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-[var(--primary-color)]/10 text-[var(--primary-dark)] flex items-center justify-center">
                      {group.id === 'access' && <Shield size={20} />}
                      {group.id === 'inventory' && <Shield size={20} />}
                      {group.id === 'orders' && <ShoppingCart size={20} />}
                      {group.id === 'customers' && <Users size={20} />}
                      {group.id === 'online_orders' && <ShoppingCart size={20} />}
                      {group.id === 'reports' && <BarChart size={20} />}
                    </div>
                    <div className="text-left">
                      <h3 className="font-bold text-gray-800">{group.title}</h3>
                      <p className="text-[10px] text-gray-400 font-medium">
                        {group.permissions.filter(p => p.enabled).length} of {group.permissions.length} permissions enabled
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`px-2.5 py-1 rounded-lg text-[10px] font-bold ${group.badgeColor}`}>
                      {group.badge}
                    </span>
                    {expandedGroups.includes(group.id) ? <ChevronUp size={20} className="text-gray-400" /> : <ChevronDown size={20} className="text-gray-400" />}
                  </div>
                </button>

                {expandedGroups.includes(group.id) && (
                  <div className="p-3 pt-0 space-y-1">
                    {group.permissions.map((permission) => (
                      <div
                        key={permission.id}
                        className={`group flex items-center justify-between p-4 rounded-2xl cursor-pointer transition-all ${
                          permission.enabled
                            ? 'bg-[var(--primary-color)]/5'
                            : 'hover:bg-gray-50'
                        }`}
                        onClick={() => togglePermission(group.id, permission.id)}
                      >
                        <span className={`text-sm font-semibold ${permission.enabled ? 'text-gray-800' : 'text-gray-500'}`}>
                          {permission.label}
                        </span>

                        <div className={`w-11 h-6 rounded-full relative transition-colors duration-200 ${
                          permission.enabled ? 'bg-[var(--primary-color)]' : 'bg-gray-200'
                        }`}>
                          <div className={`absolute top-1 left-1 bg-white w-4 h-4 rounded-full shadow-sm transition-transform duration-200 ${
                            permission.enabled ? 'translate-x-5' : 'translate-x-0'
                          }`} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-100 bg-white sticky bottom-0 z-10 flex gap-4">
          <button
            onClick={onClose}
            className="flex-1 px-8 py-4 border border-gray-200 text-gray-700 font-bold rounded-2xl hover:bg-gray-50 transition-colors"
          >
            Discard
          </button>
          <button
            onClick={handleSave}
            className="flex-[2] px-8 py-4 bg-[var(--primary-color)] text-white font-bold rounded-2xl hover:bg-[var(--primary-color)] shadow-lg flex items-center justify-center gap-2 active:scale-95 transition-all"
          >
            <Save size={20} />
            Save Transitions
          </button>
        </div>
      </div>
    </div>
  );
};

export default StaffRolePermissionsPanel;
