import React, { useEffect, useState } from 'react';
import {
  Users,
  Plus,
  Search,
  LogOut,
  Edit2,
  Trash2,
  Shield,
  Phone,
  X
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import AddStaffModal from '../components/AddStaffModal';
import StaffRolePermissionsPanel from '../components/StaffRolePermissionsPanel';
import { detectModuleFromPath } from '../../../utils/moduleAuth';
import { getStoredStaffList, setStoredStaffList, normalizeStaffMember, StaffModule } from '../../../utils/staffSession';
import { createStaff as apiCreateStaff, deleteStaff as apiDeleteStaff, getStaff as apiGetStaff, updateStaff as apiUpdateStaff } from '../../../services/api/admin/adminStaffService';
import { createRole as apiCreateRole, getRoles as apiGetRoles } from '../../../services/api/admin/adminRoleService';

export type RoleType = string;

export interface Staff {
  id: string;
  name: string;
  phone: string;
  role: RoleType;
  commission: number;
  permissions?: string[];
  avatar?: string;
}

const AdminManageStaff: React.FC = () => {
  const moduleType = (detectModuleFromPath() === 'seller' ? 'seller' : 'admin') as StaffModule;
  const [staffList, setStaffList] = useState<Staff[]>(() => {
    const stored = getStoredStaffList(moduleType);
    if (stored.length > 0) {
      return stored as Staff[];
    }
    return [];
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState<Staff | null>(null);
  const [roles, setRoles] = useState<string[]>(['STAFF', 'STOREMANAGER', 'BILLINGAGENT', 'STOCKHANDLER']);
  const [isAddRoleModalOpen, setIsAddRoleModalOpen] = useState(false);
  const [newRoleName, setNewRoleName] = useState('');
  const [isPermissionsPanelOpen, setIsPermissionsPanelOpen] = useState(false);
  const [selectedStaffForPermissions, setSelectedStaffForPermissions] = useState<Staff | null>(null);

  useEffect(() => {
    // Initial fetch from backend
    const fetchStaffAndRoles = async () => {
      try {
        const [staffResponse, rolesResponse] = await Promise.all([
          apiGetStaff(),
          apiGetRoles({ page: 1, limit: 100, sortBy: 'createdAt', sortOrder: 'asc' }),
        ]);

        if (staffResponse.success && Array.isArray(staffResponse.data)) {
          const mapped: Staff[] = staffResponse.data.map((item: any) => ({
            id: item._id || item.id,
            name: item.name,
            phone: item.phone,
            role: item.role,
            commission: item.commission ?? 0,
            permissions: item.permissions,
          }));
          setStaffList(mapped);
          setStoredStaffList(
            moduleType,
            mapped.map((staff) => normalizeStaffMember(staff))
          );
        }

        if (rolesResponse.success && Array.isArray(rolesResponse.data)) {
          const apiRoleNames = rolesResponse.data
            .map((r: any) => (r.name || '').toString().toUpperCase().replace(/\s+/g, ''))
            .filter((name: string) => !!name);
          const defaultRoles = ['STAFF', 'STOREMANAGER', 'BILLINGAGENT', 'STOCKHANDLER'];
          const merged = Array.from(new Set([...defaultRoles, ...apiRoleNames]));
          setRoles(merged);
        }
      } catch {
        // fall back to local storage data and default roles if API fails
      }
    };

    fetchStaffAndRoles();
  }, [moduleType]);

  useEffect(() => {
    setStoredStaffList(
      moduleType,
      staffList.map((staff) => normalizeStaffMember(staff))
    );
  }, [moduleType, staffList]);

  const handleAddRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRoleName.trim()) return;

    const formattedRole = newRoleName.trim().toUpperCase().replace(/\s+/g, '');

    if (roles.includes(formattedRole)) {
      toast.error('Role already exists');
      return;
    }

    try {
      const response = await apiCreateRole({ name: formattedRole });
      if (response.success && response.data) {
        setRoles(prev => [...prev, formattedRole]);
    setNewRoleName('');
    setIsAddRoleModalOpen(false);
    toast.success('New role added successfully');
      } else {
        toast.error(response.message || 'Failed to create role');
      }
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Error creating role');
    }
  };

  const filteredStaff = staffList.filter(s =>
    s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.phone.includes(searchQuery)
  );

  const handleAddStaff = async (newStaff: Omit<Staff, 'id'>) => {
    try {
      const response = await apiCreateStaff({
        name: newStaff.name,
        phone: newStaff.phone,
        role: newStaff.role,
        commission: newStaff.commission,
        permissions: newStaff.permissions,
      });
      if (response.success && response.data) {
        const created = response.data as any;
        const staffWithId: Staff = {
          id: created._id || created.id,
          name: created.name,
          phone: created.phone,
          role: created.role,
          commission: created.commission ?? 0,
          permissions: created.permissions,
        };
    setStaffList([...staffList, staffWithId]);
    setIsAddModalOpen(false);
    toast.success('Staff added successfully');
      } else {
        toast.error(response.message || 'Failed to add staff');
      }
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Error adding staff');
    }
  };

  const handleUpdateStaff = async (updatedStaff: Staff) => {
    try {
      const response = await apiUpdateStaff(updatedStaff.id, {
        name: updatedStaff.name,
        phone: updatedStaff.phone,
        role: updatedStaff.role,
        commission: updatedStaff.commission,
        permissions: updatedStaff.permissions,
      });
      if (response.success && response.data) {
    setStaffList(staffList.map(s => s.id === updatedStaff.id ? updatedStaff : s));
    setEditingStaff(null);
    setIsAddModalOpen(false);
    toast.success('Staff updated successfully');
      } else {
        toast.error(response.message || 'Failed to update staff');
      }
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Error updating staff');
    }
  };

  const handleDeleteStaff = async (id: string) => {
    setStaffToDelete(id);
    setIsDeleteConfirmOpen(true);
  };

  const handleLogoutAll = () => {
    if (moduleType === 'seller') {
      localStorage.removeItem('seller_staff_session');
      localStorage.removeItem('seller_staff_base_token');
    } else {
      localStorage.removeItem('admin_staff_session');
      localStorage.removeItem('admin_staff_base_token');
    }
    toast.success('Successfully logged out and terminated all staff sessions');
    setTimeout(() => {
      window.location.reload();
    }, 1000);
  };

  const openGlobalPermissions = () => {
    setSelectedStaffForPermissions(null);
    setIsPermissionsPanelOpen(true);
  };

  const openStaffPermissions = (staff: Staff) => {
    setSelectedStaffForPermissions(staff);
    setIsPermissionsPanelOpen(true);
  };

  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [staffToDelete, setStaffToDelete] = useState<string | null>(null);

  const confirmDeleteStaff = async () => {
    if (!staffToDelete) return;
    try {
      const response = await apiDeleteStaff(staffToDelete);
      if (response.success) {
        setStaffList(staffList.filter(s => s.id !== staffToDelete));
        toast.success('Staff deleted successfully');
      } else {
        toast.error(response.message || 'Failed to delete staff');
      }
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Error deleting staff');
    } finally {
      setIsDeleteConfirmOpen(false);
      setStaffToDelete(null);
    }
  };

  const getRoleBadgeColor = (role: string) => {
    const r = role.toUpperCase();
    if (r.includes('MANAGER')) return 'bg-[var(--primary-alpha-20)] text-[var(--primary-darker)]';
    if (r.includes('STAFF')) return 'bg-[var(--primary-alpha-20)] text-[var(--primary-darker)]';
    if (r.includes('AGENT')) return 'bg-[var(--primary-alpha-20)] text-[var(--primary-darker)]';
    if (r.includes('HANDLER')) return 'bg-orange-100 text-orange-700';
    return 'bg-pink-100 text-[var(--primary-color)]'; // Default theme color for new roles
  };

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="max-w-7xl mx-auto">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
              <Users className="text-[var(--primary-color)]" />
              Manage Staff
            </h1>
            <p className="text-gray-500 mt-1">Add, edit and manage your store staff and permissions</p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={openGlobalPermissions}
              className="p-2 border border-gray-300 rounded-lg text-gray-600 bg-white hover:bg-gray-50 transition-colors shadow-sm"
              title="Global Permissions"
            >
              <Edit2 size={18} />
            </button>
            <button
              onClick={handleLogoutAll}
              className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 bg-white hover:bg-gray-50 transition-colors shadow-sm"
            >
              <LogOut size={18} />
              Logout All Staff
            </button>
            <button
              onClick={() => setIsAddRoleModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2 border border-[var(--primary-color)] text-[var(--primary-color)] rounded-lg hover:bg-[var(--primary-color)]/5 transition-colors shadow-sm font-semibold"
            >
              <Shield size={18} />
              Add Role
            </button>
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2 bg-[var(--primary-color)] text-white rounded-lg hover:bg-[var(--primary-color)] transition-colors shadow-md font-semibold"
            >
              <Plus size={18} />
              Add Staff
            </button>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="bg-white p-4 rounded-xl shadow-sm mb-6 flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              placeholder="Search by name or phone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary-color)]/20 focus:border-[var(--primary-color)] transition-all"
            />
          </div>
        </div>

        {/* Staff List Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredStaff.map((staff) => (
            <div key={staff.id} className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-shadow relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-3 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => {
                    setEditingStaff(staff);
                    setIsAddModalOpen(true);
                  }}
                  className="p-2 bg-[var(--primary-alpha-10)] text-[var(--primary-dark)] rounded-full hover:bg-[var(--primary-alpha-20)] transition-colors"
                >
                  <Edit2 size={16} />
                </button>
                <button
                  onClick={() => handleDeleteStaff(staff.id)}
                  className="p-2 bg-red-50 text-red-600 rounded-full hover:bg-red-100 transition-colors"
                >
                  <Trash2 size={16} />
                </button>
              </div>

              <div className="flex items-start gap-4">
                <div className="w-16 h-16 rounded-full bg-[var(--primary-color)]/10 flex items-center justify-center text-[var(--primary-color)] font-bold text-xl border-2 border-[var(--primary-color)]/20">
                  {staff.avatar ? (
                    <img src={staff.avatar} alt={staff.name} className="w-full h-full rounded-full object-cover" />
                  ) : (
                    staff.name.charAt(0)
                  )}
                </div>

                <div className="flex-1">
                  <h3 className="font-bold text-gray-800 text-lg">{staff.name}</h3>
                  <div className="flex items-center gap-1 text-gray-500 mt-1">
                    <Phone size={14} />
                    <span className="text-sm">{staff.phone}</span>
                  </div>
                  <div className="mt-3">
                    <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${getRoleBadgeColor(staff.role)}`}>
                      {staff.role.replace(/_/g, ' ')}
                    </span>
                  </div>
                  <div className="mt-2 text-xs font-semibold text-gray-600">
                    Commission: {staff.commission}%
                  </div>
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-gray-50 flex items-center justify-between">
                <button
                  onClick={() => openStaffPermissions(staff)}
                  className="flex items-center gap-2 text-sm font-semibold text-[var(--primary-color)] hover:text-[var(--primary-color)] transition-colors"
                >
                  <Shield size={16} />
                  Manage Permissions
                </button>
                <div className="flex items-center gap-2">
                  <Edit2
                    size={16}
                    className="text-gray-400 cursor-pointer hover:text-[var(--primary-color)]"
                    onClick={() => {
                      setEditingStaff(staff);
                      setIsAddModalOpen(true);
                    }}
                  />
                </div>
              </div>
            </div>
          ))}

          {/* Add New Staff Card */}
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="border-2 border-dashed border-gray-200 rounded-2xl p-6 flex flex-col items-center justify-center gap-3 text-gray-400 hover:border-[var(--primary-color)] hover:text-[var(--primary-color)] hover:bg-[var(--primary-color)]/5 transition-all group"
          >
            <div className="w-12 h-12 rounded-full border-2 border-dashed border-gray-300 flex items-center justify-center group-hover:border-[var(--primary-color)]">
              <Plus size={24} />
            </div>
            <span className="font-semibold">Add New Staff</span>
          </button>
        </div>

        {/* Empty State */}
        {filteredStaff.length === 0 && searchQuery && (
          <div className="text-center py-20">
            <div className="bg-gray-100 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4 text-gray-400">
              <Users size={40} />
            </div>
            <h2 className="text-xl font-bold text-gray-700">No staff found</h2>
            <p className="text-gray-500">Try adjusting your search query</p>
          </div>
        )}
      </div>

      {/* Modals and Panels */}
      {isAddModalOpen && (
        <AddStaffModal
          isOpen={isAddModalOpen}
          roles={roles}
          onClose={() => {
            setIsAddModalOpen(false);
            setEditingStaff(null);
          }}
          onSave={editingStaff ? handleUpdateStaff : handleAddStaff}
          staff={editingStaff || undefined}
        />
      )}

      {/* Delete confirmation modal */}
      {isDeleteConfirmOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-red-50 to-transparent">
              <h2 className="text-lg font-bold text-gray-800">Delete Staff Member</h2>
              <button
                onClick={() => {
                  setIsDeleteConfirmOpen(false);
                  setStaffToDelete(null);
                }}
                className="p-2 hover:bg-gray-100 rounded-full text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-sm text-gray-600">
                Are you sure you want to delete this staff member? This action cannot be undone.
              </p>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsDeleteConfirmOpen(false);
                    setStaffToDelete(null);
                  }}
                  className="flex-1 px-4 py-3 border border-gray-200 text-gray-600 font-semibold rounded-2xl hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={confirmDeleteStaff}
                  className="flex-1 px-4 py-3 bg-red-500 text-white font-semibold rounded-2xl hover:bg-red-600 transition-all shadow-lg active:scale-95"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {isPermissionsPanelOpen && (
        <StaffRolePermissionsPanel
          isOpen={isPermissionsPanelOpen}
          roles={roles}
          onClose={() => setIsPermissionsPanelOpen(false)}
          staff={selectedStaffForPermissions}
        />
      )}

      {/* Add Role Modal */}
      {isAddRoleModalOpen && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-[var(--primary-color)]/5 to-transparent">
              <h2 className="text-xl font-bold text-gray-800">Add New Role</h2>
              <button
                onClick={() => setIsAddRoleModalOpen(false)}
                className="p-2 hover:bg-gray-100 rounded-full text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleAddRole} className="p-6 space-y-4">
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-gray-700 ml-1">Role Name</label>
                <input
                  type="text"
                  required
                  autoFocus
                  placeholder="Ex. MANAGER, SUPERVISOR"
                  value={newRoleName}
                  onChange={(e) => setNewRoleName(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-[var(--primary-color)]/20 focus:border-[var(--primary-color)] transition-all uppercase"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddRoleModalOpen(false)}
                  className="flex-1 px-4 py-3 border border-gray-200 text-gray-600 font-semibold rounded-2xl hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-3 bg-[var(--primary-color)] text-white font-semibold rounded-2xl hover:bg-[var(--primary-color)] transition-all shadow-lg active:scale-95"
                >
                  Save Role
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminManageStaff;
