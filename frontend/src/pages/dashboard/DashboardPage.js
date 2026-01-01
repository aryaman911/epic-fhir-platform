import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { 
  Users, FileHeart, Megaphone, TrendingUp, Activity, 
  AlertCircle, CheckCircle2, Clock, ArrowRight, Zap
} from 'lucide-react';
import { analyticsApi, epicApi } from '../../services/api';
import useAuthStore from '../../stores/authStore';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
} from 'chart.js';
import { Doughnut, Bar } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement
);

const StatCard = ({ title, value, icon: Icon, trend, color = 'primary' }) => {
  const colors = {
    primary: 'bg-primary-50 text-primary-600',
    green: 'bg-green-50 text-green-600',
    amber: 'bg-amber-50 text-amber-600',
    red: 'bg-red-50 text-red-600',
  };

  return (
    <div className="card p-6">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-slate-500">{title}</p>
          <p className="text-3xl font-bold text-slate-900 mt-1">{value}</p>
          {trend && (
            <p className={`text-sm mt-2 flex items-center gap-1 ${trend > 0 ? 'text-green-600' : 'text-red-600'}`}>
              <TrendingUp className="w-4 h-4" />
              {trend > 0 ? '+' : ''}{trend}% vs last month
            </p>
          )}
        </div>
        <div className={`p-3 rounded-xl ${colors[color]}`}>
          <Icon className="w-6 h-6" />
        </div>
      </div>
    </div>
  );
};

export default function DashboardPage() {
  const { user, organization } = useAuthStore();

  const { data: dashboardData, isLoading } = useQuery({
    queryKey: ['dashboard'],
    queryFn: async () => {
      const response = await analyticsApi.dashboard();
      return response.data;
    },
  });

  const { data: epicStatus } = useQuery({
    queryKey: ['epicStatus'],
    queryFn: async () => {
      const response = await epicApi.connectionStatus();
      return response.data;
    },
  });

  const campaignData = {
    labels: ['Sent', 'Delivered', 'Opened', 'Responded'],
    datasets: [{
      data: [
        dashboardData?.outreachSent || 0,
        Math.floor((dashboardData?.outreachSent || 0) * 0.95),
        Math.floor((dashboardData?.outreachSent || 0) * 0.45),
        Math.floor((dashboardData?.outreachSent || 0) * 0.12),
      ],
      backgroundColor: ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6'],
    }],
  };

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">
          Welcome back, {user?.firstName}
        </h1>
        <p className="text-slate-500 mt-1">
          Here's what's happening with your patient outreach
        </p>
      </div>

      {/* EPIC Connection Status */}
      {!epicStatus?.connected && (
        <div className="mb-6 p-4 rounded-xl bg-amber-50 border border-amber-200 flex items-center gap-4">
          <AlertCircle className="w-6 h-6 text-amber-600 flex-shrink-0" />
          <div className="flex-1">
            <p className="font-medium text-amber-800">Connect to EPIC</p>
            <p className="text-sm text-amber-600">
              Connect your EPIC FHIR account to access patient data and start campaigns
            </p>
          </div>
          <Link to="/settings" className="btn-primary">
            Connect EPIC
          </Link>
        </div>
      )}

      {epicStatus?.connected && (
        <div className="mb-6 p-4 rounded-xl bg-green-50 border border-green-200 flex items-center gap-4">
          <CheckCircle2 className="w-6 h-6 text-green-600 flex-shrink-0" />
          <div className="flex-1">
            <p className="font-medium text-green-800">EPIC Connected</p>
            <p className="text-sm text-green-600">
              Your EPIC FHIR integration is active and syncing patient data
            </p>
          </div>
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatCard
          title="Active Care Plans"
          value={dashboardData?.carePlansActive || 0}
          icon={FileHeart}
          color="primary"
        />
        <StatCard
          title="Active Campaigns"
          value={dashboardData?.campaignsActive || 0}
          icon={Megaphone}
          color="green"
        />
        <StatCard
          title="Patients Targeted"
          value={dashboardData?.patientsTargeted?.toLocaleString() || 0}
          icon={Users}
          color="amber"
        />
        <StatCard
          title="Conversion Rate"
          value={`${dashboardData?.conversionRate || 0}%`}
          icon={TrendingUp}
          trend={5.2}
          color="primary"
        />
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Campaign Performance */}
        <div className="lg:col-span-2 card p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-slate-900">Campaign Performance</h2>
            <Link to="/analytics" className="text-sm text-primary-600 hover:text-primary-700 flex items-center gap-1">
              View Details <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
          
          <div className="h-64">
            <Bar
              data={{
                labels: ['Week 1', 'Week 2', 'Week 3', 'Week 4'],
                datasets: [
                  {
                    label: 'Outreach Sent',
                    data: [120, 190, 150, 220],
                    backgroundColor: '#3b82f6',
                  },
                  {
                    label: 'Responses',
                    data: [15, 28, 22, 35],
                    backgroundColor: '#10b981',
                  },
                ],
              }}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                  legend: {
                    position: 'bottom',
                  },
                },
                scales: {
                  y: {
                    beginAtZero: true,
                  },
                },
              }}
            />
          </div>
        </div>

        {/* Outreach Funnel */}
        <div className="card p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-6">Outreach Funnel</h2>
          <div className="h-48">
            <Doughnut
              data={campaignData}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                  legend: {
                    position: 'bottom',
                  },
                },
              }}
            />
          </div>
        </div>

        {/* Quick Actions */}
        <div className="card p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">Quick Actions</h2>
          <div className="space-y-3">
            <Link 
              to="/patients" 
              className="flex items-center gap-3 p-3 rounded-lg bg-slate-50 hover:bg-slate-100 transition-colors"
            >
              <div className="p-2 rounded-lg bg-primary-100">
                <Users className="w-5 h-5 text-primary-600" />
              </div>
              <div>
                <p className="font-medium text-slate-900">Browse Patients</p>
                <p className="text-sm text-slate-500">View and analyze patient data</p>
              </div>
            </Link>
            
            <Link 
              to="/campaigns" 
              className="flex items-center gap-3 p-3 rounded-lg bg-slate-50 hover:bg-slate-100 transition-colors"
            >
              <div className="p-2 rounded-lg bg-green-100">
                <Megaphone className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="font-medium text-slate-900">Create Campaign</p>
                <p className="text-sm text-slate-500">Start a new outreach campaign</p>
              </div>
            </Link>
            
            <Link 
              to="/ai-playground" 
              className="flex items-center gap-3 p-3 rounded-lg bg-slate-50 hover:bg-slate-100 transition-colors"
            >
              <div className="p-2 rounded-lg bg-purple-100">
                <Zap className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className="font-medium text-slate-900">AI Analysis</p>
                <p className="text-sm text-slate-500">Use AI for patient insights</p>
              </div>
            </Link>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="lg:col-span-2 card p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">Recent Activity</h2>
          <div className="space-y-4">
            {[
              { action: 'Campaign "Diabetes Q1" started', time: '2 hours ago', icon: Megaphone, color: 'green' },
              { action: '45 patients added to Heart Failure program', time: '5 hours ago', icon: Users, color: 'primary' },
              { action: 'AI analysis completed for 120 patients', time: '1 day ago', icon: Zap, color: 'purple' },
              { action: 'New care plan template created', time: '2 days ago', icon: FileHeart, color: 'amber' },
            ].map((item, index) => (
              <div key={index} className="flex items-center gap-4">
                <div className={`p-2 rounded-lg bg-${item.color}-100`}>
                  <item.icon className={`w-4 h-4 text-${item.color}-600`} />
                </div>
                <div className="flex-1">
                  <p className="text-sm text-slate-900">{item.action}</p>
                  <p className="text-xs text-slate-500">{item.time}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
