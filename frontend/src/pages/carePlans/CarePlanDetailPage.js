import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, FileHeart, CheckCircle } from 'lucide-react';
import { carePlansApi } from '../../services/api';

export default function CarePlanDetailPage() {
  const { id } = useParams();
  
  const { data, isLoading } = useQuery({
    queryKey: ['carePlan', id],
    queryFn: async () => {
      const response = await carePlansApi.get(id);
      return response.data;
    },
  });

  if (isLoading) return <p>Loading...</p>;

  const plan = data?.carePlan;

  return (
    <div className="animate-fade-in">
      <Link to="/care-plans" className="text-sm text-slate-500 hover:text-slate-700 flex items-center gap-1 mb-4">
        <ArrowLeft className="w-4 h-4" />
        Back to Care Plans
      </Link>

      <div className="card p-6 mb-6">
        <div className="flex items-start gap-4">
          <div className="p-4 rounded-xl bg-primary-100">
            <FileHeart className="w-8 h-8 text-primary-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">{plan?.name}</h1>
            <p className="text-slate-500 mt-1">{plan?.description}</p>
            <div className="flex items-center gap-2 mt-3">
              <span className="badge badge-info">{plan?.category}</span>
              <span className="badge badge-success">{plan?.duration}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card p-6">
          <h2 className="font-semibold text-slate-900 mb-4">Target ICD-10 Codes</h2>
          <div className="flex flex-wrap gap-2">
            {plan?.icd10Codes?.map((code) => (
              <span key={code} className="px-3 py-1 bg-slate-100 rounded-full text-sm font-mono">
                {code}
              </span>
            ))}
          </div>
        </div>

        <div className="card p-6">
          <h2 className="font-semibold text-slate-900 mb-4">Expected Outcomes</h2>
          <ul className="space-y-2">
            {plan?.outcomes?.map((outcome, i) => (
              <li key={i} className="flex items-start gap-2">
                <CheckCircle className="w-5 h-5 text-green-500 mt-0.5" />
                <span>{outcome}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="lg:col-span-2 card p-6">
          <h2 className="font-semibold text-slate-900 mb-4">Interventions</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {plan?.interventions?.map((intervention, i) => (
              <div key={i} className="p-4 bg-slate-50 rounded-lg">
                <p className="font-medium">{intervention.name}</p>
                <p className="text-sm text-slate-500">Frequency: {intervention.frequency}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
