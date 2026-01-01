import React, { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Settings, Link2, CheckCircle, AlertCircle, Loader2, Key, Building2 } from 'lucide-react';
import { authApi, epicApi, adminApi } from '../../services/api';
import useAuthStore from '../../stores/authStore';
import toast from 'react-hot-toast';

export default function SettingsPage() {
  const { user, organization } = useAuthStore();
  const [epicClientId, setEpicClientId] = useState('');
  const [epicClientSecret, setEpicClientSecret] = useState('');

  const { data: epicStatus, refetch: refetchEpicStatus } = useQuery({
    queryKey: ['epicStatus'],
    queryFn: async () => {
      const response = await epicApi.connectionStatus();
      return response.data;
    },
  });

  const connectEpicMutation = useMutation({
    mutationFn: async () => {
      const response = await authApi.epicAuthorize();
      return response.data;
    },
    onSuccess: (data) => {
      // Redirect to EPIC authorization
      window.location.href = data.authorizationUrl;
    },
    onError: () => {
      toast.error('Failed to initiate EPIC connection');
    },
  });

  const disconnectEpicMutation = useMutation({
    mutationFn: async () => {
      await authApi.epicDisconnect();
    },
    onSuccess: () => {
      toast.success('EPIC disconnected');
      refetchEpicStatus();
    },
  });

  const saveSettingsMutation = useMutation({
    mutationFn: async (data) => {
      await adminApi.updateSettings(data);
    },
    onSuccess: () => {
      toast.success('Settings saved');
    },
  });

  return (
    <div className="animate-fade-in max-w-4xl">
      <div className="page-header">
        <h1 className="page-title flex items-center gap-2">
          <Settings className="w-8 h-8" />
          Settings
        </h1>
        <p className="page-subtitle">Manage your account and integrations</p>
      </div>

      <div className="space-y-6">
        {/* Profile */}
        <div className="card p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">Profile</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">First Name</label>
              <input type="text" className="input" value={user?.firstName || ''} readOnly />
            </div>
            <div>
              <label className="label">Last Name</label>
              <input type="text" className="input" value={user?.lastName || ''} readOnly />
            </div>
            <div className="col-span-2">
              <label className="label">Email</label>
              <input type="email" className="input" value={user?.email || ''} readOnly />
            </div>
            <div>
              <label className="label">Role</label>
              <input type="text" className="input capitalize" value={user?.role?.replace('_', ' ') || ''} readOnly />
            </div>
          </div>
        </div>

        {/* Organization */}
        <div className="card p-6">
          <div className="flex items-center gap-2 mb-4">
            <Building2 className="w-5 h-5 text-slate-400" />
            <h2 className="text-lg font-semibold text-slate-900">Organization</h2>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Organization Name</label>
              <input type="text" className="input" value={organization?.name || ''} readOnly />
            </div>
            <div>
              <label className="label">Subscription</label>
              <input type="text" className="input capitalize" value={organization?.subscriptionTier || 'Free'} readOnly />
            </div>
          </div>
        </div>

        {/* EPIC Integration */}
        <div className="card p-6">
          <div className="flex items-center gap-2 mb-4">
            <Link2 className="w-5 h-5 text-slate-400" />
            <h2 className="text-lg font-semibold text-slate-900">EPIC FHIR Integration</h2>
          </div>

          {epicStatus?.connected ? (
            <div className="p-4 rounded-lg bg-green-50 border border-green-200 mb-4">
              <div className="flex items-center gap-3">
                <CheckCircle className="w-6 h-6 text-green-600" />
                <div>
                  <p className="font-medium text-green-800">Connected to EPIC</p>
                  <p className="text-sm text-green-600">
                    Token expires: {epicStatus.tokenExpiry ? new Date(epicStatus.tokenExpiry).toLocaleString() : 'N/A'}
                  </p>
                </div>
              </div>
              <button
                className="btn-danger mt-4"
                onClick={() => disconnectEpicMutation.mutate()}
                disabled={disconnectEpicMutation.isPending}
              >
                Disconnect EPIC
              </button>
            </div>
          ) : (
            <div className="p-4 rounded-lg bg-amber-50 border border-amber-200 mb-4">
              <div className="flex items-center gap-3">
                <AlertCircle className="w-6 h-6 text-amber-600" />
                <div>
                  <p className="font-medium text-amber-800">Not Connected</p>
                  <p className="text-sm text-amber-600">Connect your EPIC account to access patient data</p>
                </div>
              </div>
              <button
                className="btn-primary mt-4"
                onClick={() => connectEpicMutation.mutate()}
                disabled={connectEpicMutation.isPending}
              >
                {connectEpicMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <Link2 className="w-4 h-4 mr-2" />
                )}
                Connect to EPIC
              </button>
            </div>
          )}

          <div className="border-t border-slate-200 pt-4 mt-4">
            <h3 className="font-medium text-slate-900 mb-3">EPIC Credentials (Admin Only)</h3>
            <div className="grid grid-cols-1 gap-4">
              <div>
                <label className="label">Client ID</label>
                <input
                  type="text"
                  className="input font-mono"
                  placeholder="Enter EPIC Client ID"
                  value={epicClientId}
                  onChange={(e) => setEpicClientId(e.target.value)}
                />
              </div>
              <div>
                <label className="label">Client Secret</label>
                <input
                  type="password"
                  className="input font-mono"
                  placeholder="Enter EPIC Client Secret"
                  value={epicClientSecret}
                  onChange={(e) => setEpicClientSecret(e.target.value)}
                />
              </div>
              <button
                className="btn-secondary"
                onClick={() => saveSettingsMutation.mutate({ epicClientId, epicClientSecret })}
                disabled={saveSettingsMutation.isPending}
              >
                Save EPIC Credentials
              </button>
            </div>
          </div>
        </div>

        {/* API Keys */}
        <div className="card p-6">
          <div className="flex items-center gap-2 mb-4">
            <Key className="w-5 h-5 text-slate-400" />
            <h2 className="text-lg font-semibold text-slate-900">AI API Keys</h2>
          </div>
          <p className="text-sm text-slate-500 mb-4">
            API keys are configured server-side. Contact your administrator to update AI service credentials.
          </p>
          <div className="grid grid-cols-2 gap-4">
            <div className="p-3 rounded-lg bg-slate-50">
              <p className="text-sm font-medium">OpenAI</p>
              <p className="text-xs text-slate-500">GPT-4 Turbo configured</p>
            </div>
            <div className="p-3 rounded-lg bg-slate-50">
              <p className="text-sm font-medium">Anthropic</p>
              <p className="text-xs text-slate-500">Claude 3.5 Sonnet configured</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
