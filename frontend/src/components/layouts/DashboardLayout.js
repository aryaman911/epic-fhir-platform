import React, { useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, Users, FileHeart, Megaphone, BarChart3, 
  Sparkles, Settings, LogOut, Menu, X, Building2, ChevronDown,
  UserCircle, Shield
} from 'lucide-react';
import useAuthStore from '../../stores/authStore';
import clsx from 'clsx';

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Patients', href: '/patients', icon: Users },
  { name: 'Care Plans', href: '/care-plans', icon: FileHeart },
  { name: 'Campaigns', href: '/campaigns', icon: Megaphone },
  { name: 'Analytics', href: '/analytics', icon: BarChart3 },
  { name: 'AI Playground', href: '/ai-playground', icon: Sparkles },
];

const adminNavigation = [
  { name: 'Users', href: '/admin/users', icon: Shield },
];

export default function DashboardLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const { user, organization, logout, isAdmin } = useAuthStore();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={clsx(
        'fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-slate-200 transform transition-transform duration-200 lg:translate-x-0',
        sidebarOpen ? 'translate-x-0' : '-translate-x-full'
      )}>
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="flex items-center gap-3 px-6 py-5 border-b border-slate-200">
            <div className="w-10 h-10 rounded-xl gradient-healthcare flex items-center justify-center">
              <FileHeart className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="font-bold text-slate-900">CareFlow</h1>
              <p className="text-xs text-slate-500">Analytics Platform</p>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
            {navigation.map((item) => (
              <NavLink
                key={item.name}
                to={item.href}
                className={({ isActive }) => clsx(
                  'sidebar-link',
                  isActive && 'active'
                )}
                onClick={() => setSidebarOpen(false)}
              >
                <item.icon className="w-5 h-5" />
                {item.name}
              </NavLink>
            ))}

            {isAdmin() && (
              <>
                <div className="pt-4 mt-4 border-t border-slate-200">
                  <p className="px-4 text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                    Admin
                  </p>
                  {adminNavigation.map((item) => (
                    <NavLink
                      key={item.name}
                      to={item.href}
                      className={({ isActive }) => clsx(
                        'sidebar-link',
                        isActive && 'active'
                      )}
                      onClick={() => setSidebarOpen(false)}
                    >
                      <item.icon className="w-5 h-5" />
                      {item.name}
                    </NavLink>
                  ))}
                </div>
              </>
            )}
          </nav>

          {/* Organization info */}
          <div className="px-4 py-4 border-t border-slate-200">
            <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-slate-50">
              <Building2 className="w-5 h-5 text-slate-400" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-900 truncate">
                  {organization?.name || 'Organization'}
                </p>
                <p className="text-xs text-slate-500 capitalize">
                  {organization?.subscriptionTier || 'Free'} Plan
                </p>
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="lg:pl-64">
        {/* Top bar */}
        <header className="sticky top-0 z-30 glass border-b border-slate-200">
          <div className="flex items-center justify-between px-4 py-3 sm:px-6">
            <button
              className="p-2 rounded-lg hover:bg-slate-100 lg:hidden"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu className="w-6 h-6" />
            </button>

            <div className="flex-1" />

            {/* Profile dropdown */}
            <div className="relative">
              <button
                className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-100"
                onClick={() => setProfileOpen(!profileOpen)}
              >
                <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center">
                  <UserCircle className="w-5 h-5 text-primary-600" />
                </div>
                <div className="hidden sm:block text-left">
                  <p className="text-sm font-medium text-slate-900">
                    {user?.firstName} {user?.lastName}
                  </p>
                  <p className="text-xs text-slate-500 capitalize">{user?.role?.replace('_', ' ')}</p>
                </div>
                <ChevronDown className="w-4 h-4 text-slate-400" />
              </button>

              {profileOpen && (
                <>
                  <div 
                    className="fixed inset-0 z-40"
                    onClick={() => setProfileOpen(false)}
                  />
                  <div className="absolute right-0 mt-2 w-56 rounded-lg bg-white shadow-lg border border-slate-200 py-1 z-50">
                    <div className="px-4 py-3 border-b border-slate-100">
                      <p className="text-sm font-medium text-slate-900">
                        {user?.email}
                      </p>
                    </div>
                    <NavLink
                      to="/settings"
                      className="flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50"
                      onClick={() => setProfileOpen(false)}
                    >
                      <Settings className="w-4 h-4" />
                      Settings
                    </NavLink>
                    <button
                      onClick={handleLogout}
                      className="flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 w-full"
                    >
                      <LogOut className="w-4 h-4" />
                      Sign out
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="p-4 sm:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
