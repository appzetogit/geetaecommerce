import { useEffect, useState, ReactNode } from 'react';
import AdminSidebar from './AdminSidebar';
import AdminHeader from './AdminHeader';
import { getStaffSession, normalizeStaffMember, setStaffSession, setStoredStaffList } from '../../../utils/staffSession';
import { getStaff as apiGetStaff } from '../../../services/api/admin/adminStaffService';

interface AdminLayoutProps {
  children: ReactNode;
}

export default function AdminLayout({ children }: AdminLayoutProps) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true); // Default to open on desktop
  const [, setStaffSyncTick] = useState(0);

  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen);
  };

  useEffect(() => {
    let isMounted = true;

    const syncStaffPermissions = async () => {
      const activeSession = getStaffSession('admin');
      if (!activeSession) return;

      try {
        const response = await apiGetStaff();
        if (!response.success || !Array.isArray(response.data)) return;

        const mapped = response.data.map((item: any) =>
          normalizeStaffMember({
            id: item._id || item.id,
            name: item.name,
            phone: item.phone,
            role: item.role,
            commission: item.commission ?? 0,
            permissions: item.permissions,
          })
        );

        setStoredStaffList('admin', mapped);

        const matched = mapped.find(
          (member) => member.id === activeSession.id || member.phone === activeSession.phone
        );
        if (!matched) return;

        setStaffSession('admin', matched);
        if (isMounted) {
          setStaffSyncTick((tick) => tick + 1);
        }
      } catch {
        // keep current session if sync request fails
      }
    };

    syncStaffPermissions();

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <div className="relative h-screen overflow-hidden bg-neutral-50">
      {/* Overlay for mobile */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={toggleSidebar}
        />
      )}

      {/* Sidebar - Fixed */}
      <div
        className={`fixed left-0 top-0 h-screen z-50 transition-transform duration-300 ease-in-out w-64 ${
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <AdminSidebar onClose={() => setIsSidebarOpen(false)} />
      </div>

      {/* Main Content */}
      <div className={`h-full flex flex-col transition-all duration-300 ${
        isSidebarOpen ? 'lg:ml-64' : 'lg:ml-0'
      }`}>
        {/* Header */}
        <AdminHeader onMenuClick={toggleSidebar} isSidebarOpen={isSidebarOpen} />

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto p-3 sm:p-4 md:p-4 bg-neutral-50 w-full overflow-x-hidden">{children}</main>
      </div>
    </div>
  );
}

