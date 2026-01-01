import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Plus, Megaphone, ChevronRight, Play, Pause, CheckCircle } from 'lucide-react';
import { campaignsApi } from '../../services/api';

const statusColors = {
  draft: 'badge-info',
  scheduled: 'badge-warning',
  in_progress: 'badge-success',
  completed: 'badge-success',
  paused: 'badge-danger',
};

export default function CampaignsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['campaigns'],
    queryFn: async () => {
      const response = await campaignsApi.list();
      return response.data;
    },
  });

  return (
    <div className="animate-fade-in">
      <div className="page-header flex items-center justify-between">
        <div>
          <h1 className="page-title">Campaigns</h1>
          <p className="page-subtitle">Manage patient outreach campaigns</p>
        </div>
        <Link to="/campaigns/new" className="btn-primary">
          <Plus className="w-4 h-4 mr-2" />
          Create Campaign
        </Link>
      </div>

      <div className="card">
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Campaign</th>
                <th>Type</th>
                <th>Patients</th>
                <th>Status</th>
                <th>Performance</th>
                <th></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {isLoading ? (
                <tr><td colSpan={6} className="text-center py-8">Loading...</td></tr>
              ) : data?.campaigns?.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-8 text-slate-500">No campaigns yet</td></tr>
              ) : (
                data?.campaigns?.map((campaign) => (
                  <tr key={campaign.id}>
                    <td>
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-green-100">
                          <Megaphone className="w-5 h-5 text-green-600" />
                        </div>
                        <div>
                          <p className="font-medium">{campaign.name}</p>
                          <p className="text-sm text-slate-500">{campaign.CarePlan?.name}</p>
                        </div>
                      </div>
                    </td>
                    <td className="capitalize">{campaign.type}</td>
                    <td>{campaign.patientCount}</td>
                    <td>
                      <span className={`badge ${statusColors[campaign.status]}`}>
                        {campaign.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td>
                      <div className="text-sm">
                        <p>Sent: {campaign.sentCount}</p>
                        <p className="text-slate-500">Enrolled: {campaign.enrollmentCount}</p>
                      </div>
                    </td>
                    <td>
                      <Link to={`/campaigns/${campaign.id}`} className="text-primary-600 hover:text-primary-700">
                        <ChevronRight className="w-5 h-5" />
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
