import React, { useState } from 'react';
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

export type RoleType = string;

export interface Staff {
  id: string;
  name: string;
  phone: string;
  role: RoleType;
  avatar?: string;
}

const AdminManageStaff: React.FC = () => {
  const [staffList, setStaffList] = useState<Staff[]>([
    { id: '1', name: 'Alaxendra', phone: '0123456789', role: 'STOREMANAGER' },
    { id: '2', name: 'James Wilson', phone: '9876543210', role: 'STAFF' },
  ]);

  const [searchQuery, setSearchQuery] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState<Staff | null>(null);
  const [roles, setRoles] = useState<string[]>(['STAFF', 'STOREMANAGER', 'BILLINGAGENT', 'STOCKHANDLER']);
  const [isAddRoleModalOpen, setIsAddRoleModalOpen] = useState(false);
  const [newRoleName, setNewRoleName] = useState('');
  const [isPermissionsPanelOpen, setIsPermissionsPanelOpen] = useState(false);
  const [selectedStaffForPermissions, setSelectedStaffForPermissions] = useState<Staff | null>(null);

  const handleAddRole = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRoleName.trim()) return;
    const formattedRole = newRoleName.trim().toUpperCase().replace(/\s+/g, '');
    if (roles.includes(formattedRole)) {
      toast.error('Role already exists');
      return;
    }
    setRoles([...roles, formattedRole]);
    setNewRoleName('');
    setIsAddRoleModalOpen(false);
    toast.success('New role added successfully');
  };

  const filteredStaff = staffList.filter(s =>
    s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.phone.includes(searchQuery)
  );

  const handleAddStaff = (newStaff: Omit<Staff, 'id'>) => {
    const staffWithId = { ...newStaff, id: Date.now().toString() };
    setStaffList([...staffList, staffWithId]);
    setIsAddModalOpen(false);
    toast.success('Staff added successfully');
  };

  const handleUpdateStaff = (updatedStaff: Staff) => {
    setStaffList(staffList.map(s => s.id === updatedStaff.id ? updatedStaff : s));
    setEditingStaff(null);
    setIsAddModalOpen(false);
    toast.success('Staff updated successfully');
  };

  const handleDeleteStaff = (id: string) => {
    if (window.confirm('Are you sure you want to delete this staff member?')) {
      setStaffList(staffList.filter(s => s.id !== id));
      toast.success('Staff deleted successfully');
    }
  };

  const handleLogoutAll = () => {
    toast.success('Successfully logged out all staff members');
  };

  const openGlobalPermissions = () => {
    setSelectedStaffForPermissions(null);
    setIsPermissionsPanelOpen(true);
  };

  const openStaffPermissions = (staff: Staff) => {
    setSelectedStaffForPermissions(staff);
    setIsPermissionsPanelOpen(true);
  };

  const getRoleBadgeColor = (role: string) => {
    const r = role.toUpperCase();
    if (r.includes('MANAGER')) return 'bg-green-100 text-green-700';
    if (r.includes('STAFF')) return 'bg-blue-100 text-blue-700';
    if (r.includes('AGENT')) return 'bg-purple-100 text-purple-700';
    if (r.includes('HANDLER')) return 'bg-orange-100 text-orange-700';
    return 'bg-pink-100 text-[#f187b5]'; // Default theme color for new roles
  };

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="max-w-7xl mx-auto">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
              <Users className="text-[#f187b5]" />
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
              className="flex items-center gap-2 px-4 py-2 border border-[#f187b5] text-[#f187b5] rounded-lg hover:bg-[#f187b5]/5 transition-colors shadow-sm font-semibold"
            >
              <Shield size={18} />
              Add Role
            </button>
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2 bg-[#f187b5] text-white rounded-lg hover:bg-[#db76a3] transition-colors shadow-md font-semibold"
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
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#f187b5]/20 focus:border-[#f187b5] transition-all"
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
                  className="p-2 bg-blue-50 text-blue-600 rounded-full hover:bg-blue-100 transition-colors"
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
                <div className="w-16 h-16 rounded-full bg-[#f187b5]/10 flex items-center justify-center text-[#f187b5] font-bold text-xl border-2 border-[#f187b5]/20">
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
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-gray-50 flex items-center justify-between">
                <button
                  onClick={() => openStaffPermissions(staff)}
                  className="flex items-center gap-2 text-sm font-semibold text-[#f187b5] hover:text-[#db76a3] transition-colors"
                >
                  <Shield size={16} />
                  Manage Permissions
                </button>
                <div className="flex items-center gap-2">
                  <Edit2
                    size={16}
                    className="text-gray-400 cursor-pointer hover:text-[#f187b5]"
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
            className="border-2 border-dashed border-gray-200 rounded-2xl p-6 flex flex-col items-center justify-center gap-3 text-gray-400 hover:border-[#f187b5] hover:text-[#f187b5] hover:bg-[#f187b5]/5 transition-all group"
          >
            <div className="w-12 h-12 rounded-full border-2 border-dashed border-gray-300 flex items-center justify-center group-hover:border-[#f187b5]">
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
            <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-[#f187b5]/5 to-transparent">
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
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#f187b5]/20 focus:border-[#f187b5] transition-all uppercase"
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
                  className="flex-1 px-4 py-3 bg-[#f187b5] text-white font-semibold rounded-2xl hover:bg-[#db76a3] transition-all shadow-lg active:scale-95"
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
