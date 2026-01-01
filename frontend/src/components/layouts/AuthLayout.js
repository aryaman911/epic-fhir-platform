import React from 'react';
import { Outlet } from 'react-router-dom';
import { FileHeart } from 'lucide-react';

export default function AuthLayout() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-900 via-primary-800 to-slate-900 flex items-center justify-center p-4">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-primary-500/20 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-healthcare-teal/20 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-md">
        {/* Logo */}
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="w-12 h-12 rounded-xl bg-white/10 backdrop-blur flex items-center justify-center">
            <FileHeart className="w-7 h-7 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">CareFlow</h1>
            <p className="text-sm text-primary-200">Healthcare Analytics Platform</p>
          </div>
        </div>

        {/* Auth card */}
        <div className="card p-8">
          <Outlet />
        </div>

        {/* Footer */}
        <p className="text-center text-sm text-primary-200 mt-6">
          © 2024 CareFlow Analytics. HIPAA Compliant.
        </p>
      </div>
    </div>
  );
}
