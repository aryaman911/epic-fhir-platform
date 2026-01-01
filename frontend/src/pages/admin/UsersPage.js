import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, User, Edit, Trash2, Shield, Loader2 } from 'lucide-react';
import { adminApi } from '../../services/api';
import toast from 'react-hot-toast';

export default function UsersPage() {
  const [showModal, setShowModal] = useState(false);
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: async () => {
      const response = await adminApi.listUsers();
      return response.data;
    },
  });

  const createMutation = useMutation({
    mutationFn: async (userData) => {
      await adminApi.createUser(userData);
    },
    onSuccess: () => {
      toast.success('User created');
      setShowModal(false);
      queryClient.invalidateQueries(['users']);
    },
    onError: (error) => {
      toast.error(error.response?.data?.error || 'Failed to create user');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (userId) => {
      await adminApi.deleteUser(userId);
    },
    onSuccess: () => {
      toast.success('User deactivated');
      queryClient.invalidateQueries(['users']);
    },
  });

  const roleColors = {
    super_admin: 'badge-danger',
    org_admin: 'badge-warning',
    analyst: 'badge-info',
    viewer: 'badge-success',
  };

  return (
    <div className="animate-fade-in">
      <div className="page-header flex items-center justify-between">
        <div>
          <h1 className="page-title flex items-center gap-2">
            <Shield className="w-8 h-8" />
            User Management
          </h1>
          <p className="page-subtitle">Manage organization users and permissions</p>
        </div>
        <button className="btn-primary" onClick={() => setShowModal(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Add User
        </button>
      </div>

      <div className="card">
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>User</th>
                <th>Role</th>
                <th>Status</th>
                <th>Last Login</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {isLoading ? (
                <tr><td colSpan={5} className="text-center py-8">Loading...</td></tr>
              ) : (
                data?.users?.map((user) => (
                  <tr key={user.id}>
                    <td>
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center">
                          <User className="w-5 h-5 text-primary-600" />
                        </div>
                        <div>
                          <p className="font-medium">{user.firstName} {user.lastName}</p>
                          <p className="text-sm text-slate-500">{user.email}</p>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className={`badge ${roleColors[user.role]}`}>
                        {user.role.replace('_', ' ')}
                      </span>
                    </td>
                    <td>
                      <span className={`badge ${user.isActive ? 'badge-success' : 'badge-danger'}`}>
                        {user.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="text-sm text-slate-500">
                      {user.lastLogin ? new Date(user.lastLogin).toLocaleDateString() : 'Never'}
                    </td>
                    <td>
                      <div className="flex items-center gap-2">
                        <button className="p-2 hover:bg-slate-100 rounded-lg">
                          <Edit className="w-4 h-4 text-slate-500" />
                        </button>
                        <button 
                          className="p-2 hover:bg-red-50 rounded-lg"
                          onClick={() => deleteMutation.mutate(user.id)}
                        >
                          <Trash2 className="w-4 h-4 text-red-500" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md mx-4">
            <h2 className="text-xl font-bold mb-4">Add New User</h2>
            <form onSubmit={(e) => {
              e.preventDefault();
              const formData = new FormData(e.target);
              createMutation.mutate({
                email: formData.get('email'),
                password: formData.get('password'),
                firstName: formData.get('firstName'),
                lastName: formData.get('lastName'),
                role: formData.get('role'),
              });
            }}>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label">First Name</label>
                    <input name="firstName" className="input" required />
                  </div>
                  <div>
                    <label className="label">Last Name</label>
                    <input name="lastName" className="input" required />
                  </div>
                </div>
                <div>
                  <label className="label">Email</label>
                  <input name="email" type="email" className="input" required />
                </div>
                <div>
                  <label className="label">Password</label>
                  <input name="password" type="password" className="input" minLength={8} required />
                </div>
                <div>
                  <label className="label">Role</label>
                  <select name="role" className="input">
                    <option value="viewer">Viewer</option>
                    <option value="analyst">Analyst</option>
                    <option value="org_admin">Admin</option>
                  </select>
                </div>
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <button type="button" className="btn-secondary" onClick={() => setShowModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary" disabled={createMutation.isPending}>
                  {createMutation.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                  Create User
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
