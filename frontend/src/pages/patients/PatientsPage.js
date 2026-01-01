import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Search, Filter, Download, ChevronRight, AlertCircle, User } from 'lucide-react';
import { epicApi } from '../../services/api';
import clsx from 'clsx';

export default function PatientsPage() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const { data, isLoading, error } = useQuery({
    queryKey: ['patients', page, search],
    queryFn: async () => {
      const response = await epicApi.getPatients({ 
        count: 50,
        name: search || undefined 
      });
      return response.data;
    },
  });

  if (error?.response?.data?.action === 'connect_epic') {
    return (
      <div className="text-center py-12">
        <AlertCircle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-slate-900 mb-2">EPIC Connection Required</h2>
        <p className="text-slate-500 mb-6">Connect your EPIC account to access patient data</p>
        <Link to="/settings" className="btn-primary">
          Connect EPIC
        </Link>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <div className="page-header flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="page-title">Patients</h1>
          <p className="page-subtitle">Browse and analyze patient data from EPIC</p>
        </div>
        <button className="btn-secondary">
          <Download className="w-4 h-4 mr-2" />
          Export
        </button>
      </div>

      {/* Search and Filter */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            type="text"
            placeholder="Search patients by name..."
            className="input pl-10"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <button className="btn-secondary">
          <Filter className="w-4 h-4 mr-2" />
          Filters
        </button>
      </div>

      {/* Patients Table */}
      <div className="card">
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Patient</th>
                <th>Date of Birth</th>
                <th>Gender</th>
                <th>Contact</th>
                <th></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="text-center py-8 text-slate-500">
                    Loading patients...
                  </td>
                </tr>
              ) : data?.patients?.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-8 text-slate-500">
                    No patients found
                  </td>
                </tr>
              ) : (
                data?.patients?.map((patient) => (
                  <tr key={patient.id}>
                    <td>
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center">
                          <User className="w-5 h-5 text-primary-600" />
                        </div>
                        <div>
                          <p className="font-medium text-slate-900">{patient.name}</p>
                          <p className="text-sm text-slate-500">ID: {patient.id.slice(0, 8)}...</p>
                        </div>
                      </div>
                    </td>
                    <td>{patient.birthDate || 'N/A'}</td>
                    <td className="capitalize">{patient.gender || 'N/A'}</td>
                    <td>
                      <div className="text-sm">
                        {patient.email && <p>{patient.email}</p>}
                        {patient.phone && <p className="text-slate-500">{patient.phone}</p>}
                        {!patient.email && !patient.phone && <span className="text-slate-400">No contact</span>}
                      </div>
                    </td>
                    <td>
                      <Link 
                        to={`/patients/${patient.id}`}
                        className="text-primary-600 hover:text-primary-700 flex items-center gap-1"
                      >
                        View <ChevronRight className="w-4 h-4" />
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-200">
          <p className="text-sm text-slate-500">
            Showing {data?.patients?.length || 0} of {data?.total || 0} patients
          </p>
          <div className="flex gap-2">
            <button 
              className="btn-secondary text-sm py-1.5"
              disabled={page === 1}
              onClick={() => setPage(p => p - 1)}
            >
              Previous
            </button>
            <button 
              className="btn-secondary text-sm py-1.5"
              onClick={() => setPage(p => p + 1)}
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
