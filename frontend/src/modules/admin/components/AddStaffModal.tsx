import React, { useState, useEffect } from 'react';
import { X, User, Phone, Shield, ArrowRight, Percent } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { Staff, RoleType } from '../pages/AdminManageStaff';

interface AddStaffModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (staff: any) => void;
  staff?: Staff;
  roles: string[];
}

const AddStaffModal: React.FC<AddStaffModalProps> = ({ isOpen, onClose, onSave, staff, roles }) => {
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    role: (staff?.role || roles[0] || 'STAFF') as string,
    commission: String(staff?.commission ?? 0)
  });

  useEffect(() => {
    if (staff) {
      setFormData({
        name: staff.name,
        phone: staff.phone,
        role: staff.role,
        commission: String(staff.commission ?? 0)
      });
    } else {
      setFormData({
        name: '',
        phone: '',
        role: 'STAFF',
        commission: '0'
      });
    }
  }, [staff]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^\d{10}$/.test(formData.phone)) {
      toast.error('Phone number must be exactly 10 digits');
      return;
    }
    const commissionValue = Number(formData.commission);
    if (Number.isNaN(commissionValue) || commissionValue < 0) {
      toast.error('Commission must be a valid non-negative number');
      return;
    }
    const payload = { ...formData, commission: commissionValue };
    if (staff) {
      onSave({ ...staff, ...payload });
    } else {
      onSave(payload);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="relative p-6 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-[var(--primary-color)]/5 to-transparent">
          <div>
            <h2 className="text-xl font-bold text-gray-800">{staff ? 'Edit Staff Member' : 'Add New Staff'}</h2>
            <p className="text-xs text-gray-500 mt-0.5">Fill in the details for the staff account</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Name Field */}
          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-gray-700 ml-1">Full Name</label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input
                type="text"
                required
                placeholder="Ex. Alaxendra"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-[var(--primary-color)]/20 focus:border-[var(--primary-color)] transition-all"
              />
            </div>
          </div>

          {/* Phone Field */}
          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-gray-700 ml-1">Phone Number</label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input
                type="tel"
                required
                placeholder="Ex. 9876543210"
                maxLength={10}
                value={formData.phone}
                onChange={(e) => {
                  const val = e.target.value.replace(/\D/g, '');
                  if (val.length <= 10) {
                    setFormData({ ...formData, phone: val });
                  }
                }}
                className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-[var(--primary-color)]/20 focus:border-[var(--primary-color)] transition-all"
              />
            </div>
          </div>


          {/* Role Dropdown */}
          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-gray-700 ml-1">Assign Role</label>
            <div className="relative">
              <Shield className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <select
                value={formData.role}
                onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                className="w-full pl-10 pr-10 py-3 bg-gray-50 border border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-[var(--primary-color)]/20 focus:border-[var(--primary-color)] transition-all appearance-none"
              >
                {roles.map(role => (
                  <option key={role} value={role}>{role.replace(/_/g, ' ')}</option>
                ))}
              </select>
              <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
                <ArrowRight size={16} className="rotate-90" />
              </div>
            </div>
          </div>

          {/* Commission Field */}
          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-gray-700 ml-1">Commission (%)</label>
            <div className="relative">
              <Percent className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input
                type="number"
                min="0"
                step="0.01"
                placeholder="Ex. 5"
                value={formData.commission}
                onChange={(e) => setFormData({ ...formData, commission: e.target.value })}
                className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-[var(--primary-color)]/20 focus:border-[var(--primary-color)] transition-all"
              />
            </div>
          </div>

          <div className="pt-4 flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-6 py-3 border border-gray-200 text-gray-600 font-semibold rounded-2xl hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-6 py-3 bg-[var(--primary-color)] text-white font-semibold rounded-2xl hover:bg-[var(--primary-color)] transition-all shadow-lg active:scale-95"
            >
              {staff ? 'Update Staff' : 'Save Staff'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddStaffModal;
