import React, { useEffect, useState } from 'react';
import { X, Shield, ChevronDown, ChevronUp, Save, ShoppingCart, Users, BarChart } from 'lucide-react';
import { Staff, RoleType } from '../pages/AdminManageStaff';
import { toast } from 'react-hot-toast';
import { useLocation } from 'react-router-dom';
import { getStoredStaffList, setStoredStaffList, StaffModule, getStaffSession, setStaffSession } from '../../../utils/staffSession';
import { updateStaff as apiUpdateStaff } from '../../../services/api/admin/adminStaffService';

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
    badgeColor: 'text-teal-600 bg-teal-50',
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
      { id: 'payment_report', label: 'Payment Report', enabled: false },
      { id: 'online_order_report', label: 'Online Order Report', enabled: false },
      { id: 'pos_invoice_report', label: 'POS Invoice Report', enabled: false },
    ]
  }
];

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
  const [expandedGroups, setExpandedGroups] = useState<string[]>(['access', 'inventory', 'orders']);

  const [permissionGroups, setPermissionGroups] = useState<PermissionGroup[]>(() =>
    isSellerManageStaff
      ? BASE_PERMISSION_GROUPS
          .map(group => ({
            ...group,
            permissions: group.permissions.filter(permission => SELLER_ALLOWED_PERMISSION_IDS.has(permission.id))
          }))
          .filter(group => group.permissions.length > 0)
      : BASE_PERMISSION_GROUPS
  );

  // Whenever panel opens for a staff member, sync toggles from stored permissions
  useEffect(() => {
    if (!staff) return;

    // Find freshest staff data from storage (may contain updated permissions)
    const storedList = getStoredStaffList(moduleType);
    const storedMember = storedList.find(m => m.id === staff.id);
    const effectivePermissions = storedMember?.permissions || staff.permissions || ['pos', 'orders', 'customers'];

    const hasPOSPermission = effectivePermissions.includes('pos');

    const UI_PREFIX = 'ui:';
    const enabledFromUi = new Set(
      effectivePermissions
        .filter((perm) => perm.startsWith(UI_PREFIX))
        .map((perm) => perm.substring(UI_PREFIX.length))
    );

    const baseGroups = isSellerManageStaff
      ? BASE_PERMISSION_GROUPS
          .map(group => ({
            ...group,
            permissions: group.permissions.filter(permission => SELLER_ALLOWED_PERMISSION_IDS.has(permission.id))
          }))
          .filter(group => group.permissions.length > 0)
      : BASE_PERMISSION_GROUPS;

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
  }, [staff, moduleType, isSellerManageStaff]);

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
    if (staff) {
      const staffList = getStoredStaffList(moduleType);

      // Collect all enabled permission IDs from UI
      const enabledPermissionIds = permissionGroups.flatMap((group) =>
        group.permissions.filter((p) => p.enabled).map((p) => p.id)
      );

      // POS access toggle still controls legacy "pos" permission (actual access check)
      const allowPOS = getPermissionEnabled('access', 'pos_access');

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
        const UI_PREFIX = 'ui:';
        const filteredBase = Array.from(baseSet).filter((perm) => !perm.startsWith(UI_PREFIX));
        const uiPermissions = enabledPermissionIds.map((id) => `${UI_PREFIX}${id}`);
        const nextPermissions = [...filteredBase, ...uiPermissions];

        return {
          ...member,
          permissions: nextPermissions,
        };
      });

      setStoredStaffList(moduleType, updatedStaffList);

      const activeSession = getStaffSession(moduleType);
      let currentMember = staff;
      if (activeSession && activeSession.id === staff.id) {
        const refreshedStaff = updatedStaffList.find((member) => member.id === staff.id);
        if (refreshedStaff) {
          setStaffSession(moduleType, refreshedStaff);
          currentMember = refreshedStaff as Staff;
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
        // Don't break UI if API fails; just log in console
        // eslint-disable-next-line no-console
        console.error('Failed to update staff permissions', error);
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
            <div className="w-10 h-10 rounded-full bg-[#f187b5]/10 flex items-center justify-center text-[#f187b5]">
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
                    className="w-full pl-4 pr-10 py-3 bg-white border border-gray-200 rounded-xl font-semibold text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#f187b5]/20 appearance-none cursor-pointer"
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
                    <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-600 flex items-center justify-center">
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
                            ? 'bg-[#f187b5]/5'
                            : 'hover:bg-gray-50'
                        }`}
                        onClick={() => togglePermission(group.id, permission.id)}
                      >
                        <span className={`text-sm font-semibold ${permission.enabled ? 'text-gray-800' : 'text-gray-500'}`}>
                          {permission.label}
                        </span>

                        <div className={`w-11 h-6 rounded-full relative transition-colors duration-200 ${
                          permission.enabled ? 'bg-green-500' : 'bg-gray-200'
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
            className="flex-[2] px-8 py-4 bg-[#f187b5] text-white font-bold rounded-2xl hover:bg-[#db76a3] shadow-lg flex items-center justify-center gap-2 active:scale-95 transition-all"
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
