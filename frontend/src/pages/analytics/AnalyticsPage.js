import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { BarChart3, TrendingUp, Users, Activity } from 'lucide-react';
import { analyticsApi } from '../../services/api';
import { Bar, Doughnut } from 'react-chartjs-2';

export default function AnalyticsPage() {
  const { data: population } = useQuery({
    queryKey: ['populationAnalytics'],
    queryFn: async () => {
      const response = await analyticsApi.population();
      return response.data;
    },
  });

  const { data: performance } = useQuery({
    queryKey: ['campaignPerformance'],
    queryFn: async () => {
      const response = await analyticsApi.campaignPerformance();
      return response.data;
    },
  });

  const conditionChartData = {
    labels: population?.topConditions?.slice(0, 8).map(c => c.code) || [],
    datasets: [{
      label: 'Patient Count',
      data: population?.topConditions?.slice(0, 8).map(c => c.patientCount) || [],
      backgroundColor: '#3b82f6',
    }],
  };

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <h1 className="page-title">Analytics</h1>
        <p className="page-subtitle">Population health insights and campaign performance</p>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="stat-card">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-primary-100">
              <Users className="w-6 h-6 text-primary-600" />
            </div>
            <div>
              <p className="stat-value">{population?.totalPatients || 0}</p>
              <p className="stat-label">Total Patients</p>
            </div>
          </div>
        </div>
        <div className="stat-card">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-green-100">
              <Activity className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <p className="stat-value">{population?.totalConditions || 0}</p>
              <p className="stat-label">Total Conditions</p>
            </div>
          </div>
        </div>
        <div className="stat-card">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-amber-100">
              <BarChart3 className="w-6 h-6 text-amber-600" />
            </div>
            <div>
              <p className="stat-value">{performance?.totals?.campaigns || 0}</p>
              <p className="stat-label">Campaigns Run</p>
            </div>
          </div>
        </div>
        <div className="stat-card">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-purple-100">
              <TrendingUp className="w-6 h-6 text-purple-600" />
            </div>
            <div>
              <p className="stat-value">{performance?.totals?.enrolled || 0}</p>
              <p className="stat-label">Enrollments</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Conditions */}
        <div className="card p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">Top Conditions (ICD-10)</h2>
          <div className="h-80">
            <Bar
              data={conditionChartData}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                indexAxis: 'y',
                plugins: { legend: { display: false } },
              }}
            />
          </div>
        </div>

        {/* Condition Distribution */}
        <div className="card p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">Condition Categories</h2>
          <div className="space-y-3">
            {population?.topConditions?.slice(0, 10).map((condition, index) => (
              <div key={index} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="w-8 h-8 rounded bg-primary-100 flex items-center justify-center text-sm font-mono text-primary-700">
                    {condition.code?.slice(0, 3)}
                  </span>
                  <div>
                    <p className="text-sm font-medium text-slate-900">{condition.display?.slice(0, 40)}...</p>
                    <p className="text-xs text-slate-500">{condition.patientCount} patients ({condition.prevalence}%)</p>
                  </div>
                </div>
                <div className="w-24 h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-primary-500 rounded-full"
                    style={{ width: `${Math.min(parseFloat(condition.prevalence) * 2, 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Campaign Performance Table */}
        <div className="lg:col-span-2 card p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">Campaign Performance</h2>
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Campaign</th>
                  <th>Targeted</th>
                  <th>Sent</th>
                  <th>Opened</th>
                  <th>Responded</th>
                  <th>Enrolled</th>
                  <th>Conversion</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {performance?.campaigns?.map((campaign, index) => (
                  <tr key={index}>
                    <td className="font-medium">{campaign.name}</td>
                    <td>{campaign.metrics.targeted}</td>
                    <td>{campaign.metrics.sent}</td>
                    <td>{campaign.metrics.opened}</td>
                    <td>{campaign.metrics.responded}</td>
                    <td>{campaign.metrics.enrolled}</td>
                    <td>
                      <span className="badge badge-success">{campaign.rates.conversionRate}%</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
