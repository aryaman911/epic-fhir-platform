// Care Plans Page
import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Plus, FileHeart, ChevronRight } from 'lucide-react';
import { carePlansApi } from '../../services/api';

export default function CarePlansPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['carePlans'],
    queryFn: async () => {
      const response = await carePlansApi.list();
      return response.data;
    },
  });

  return (
    <div className="animate-fade-in">
      <div className="page-header flex items-center justify-between">
        <div>
          <h1 className="page-title">Care Plans</h1>
          <p className="page-subtitle">Manage your care plan templates and programs</p>
        </div>
        <Link to="/care-plans/new" className="btn-primary">
          <Plus className="w-4 h-4 mr-2" />
          Create Care Plan
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {isLoading ? (
          <p>Loading...</p>
        ) : (
          data?.carePlans?.map((plan) => (
            <Link key={plan.id} to={`/care-plans/${plan.id}`} className="card p-6 hover:shadow-md transition-shadow">
              <div className="flex items-start gap-4">
                <div className="p-3 rounded-lg bg-primary-100">
                  <FileHeart className="w-6 h-6 text-primary-600" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-slate-900">{plan.name}</h3>
                  <p className="text-sm text-slate-500 mt-1 line-clamp-2">{plan.description}</p>
                  <div className="flex items-center gap-2 mt-3">
                    <span className="badge badge-info">{plan.category || 'General'}</span>
                    {plan.isTemplate && <span className="badge badge-warning">Template</span>}
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-slate-400" />
              </div>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
