import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { ArrowLeft, Play, Pause, Users, Mail, Sparkles, Loader2 } from 'lucide-react';
import { campaignsApi } from '../../services/api';
import toast from 'react-hot-toast';

export default function CampaignDetailPage() {
  const { id } = useParams();

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['campaign', id],
    queryFn: async () => {
      const response = await campaignsApi.get(id);
      return response.data;
    },
  });

  const targetMutation = useMutation({
    mutationFn: () => campaignsApi.targetPatients(id),
    onSuccess: () => {
      toast.success('Target patients identified');
      refetch();
    },
  });

  const sendMutation = useMutation({
    mutationFn: () => campaignsApi.send(id),
    onSuccess: () => {
      toast.success('Campaign sent!');
      refetch();
    },
  });

  if (isLoading) return <p>Loading...</p>;

  const campaign = data?.campaign;

  return (
    <div className="animate-fade-in">
      <Link to="/campaigns" className="text-sm text-slate-500 hover:text-slate-700 flex items-center gap-1 mb-4">
        <ArrowLeft className="w-4 h-4" />
        Back to Campaigns
      </Link>

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{campaign?.name}</h1>
          <p className="text-slate-500">{campaign?.CarePlan?.name}</p>
        </div>
        <div className="flex gap-3">
          <button 
            className="btn-secondary"
            onClick={() => targetMutation.mutate()}
            disabled={targetMutation.isPending}
          >
            {targetMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Users className="w-4 h-4 mr-2" />}
            Find Patients
          </button>
          <button 
            className="btn-primary"
            onClick={() => sendMutation.mutate()}
            disabled={sendMutation.isPending || campaign?.status === 'completed'}
          >
            {sendMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Mail className="w-4 h-4 mr-2" />}
            Send Campaign
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
        <div className="stat-card">
          <p className="stat-value">{campaign?.patientCount || 0}</p>
          <p className="stat-label">Target Patients</p>
        </div>
        <div className="stat-card">
          <p className="stat-value">{campaign?.sentCount || 0}</p>
          <p className="stat-label">Outreach Sent</p>
        </div>
        <div className="stat-card">
          <p className="stat-value">{campaign?.responseCount || 0}</p>
          <p className="stat-label">Responses</p>
        </div>
        <div className="stat-card">
          <p className="stat-value">{campaign?.enrollmentCount || 0}</p>
          <p className="stat-label">Enrollments</p>
        </div>
      </div>

      <div className="card p-6">
        <h2 className="font-semibold text-slate-900 mb-4">Campaign Details</h2>
        <dl className="grid grid-cols-2 gap-4">
          <div>
            <dt className="text-sm text-slate-500">Type</dt>
            <dd className="font-medium capitalize">{campaign?.type}</dd>
          </div>
          <div>
            <dt className="text-sm text-slate-500">Status</dt>
            <dd className="font-medium capitalize">{campaign?.status?.replace('_', ' ')}</dd>
          </div>
          <div>
            <dt className="text-sm text-slate-500">Created</dt>
            <dd className="font-medium">{new Date(campaign?.createdAt).toLocaleDateString()}</dd>
          </div>
          <div>
            <dt className="text-sm text-slate-500">Care Plan</dt>
            <dd className="font-medium">{campaign?.CarePlan?.name}</dd>
          </div>
        </dl>
      </div>
    </div>
  );
}
