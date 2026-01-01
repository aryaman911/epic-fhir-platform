import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { 
  ArrowLeft, User, Calendar, Mail, Phone, MapPin, 
  Activity, Pill, FileText, Sparkles, Loader2, AlertTriangle
} from 'lucide-react';
import { patientsApi, aiApi } from '../../services/api';
import toast from 'react-hot-toast';

export default function PatientDetailPage() {
  const { id } = useParams();
  const [showAIAnalysis, setShowAIAnalysis] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['patient', id],
    queryFn: async () => {
      const response = await patientsApi.get(id);
      return response.data;
    },
  });

  const analyzeMutation = useMutation({
    mutationFn: async () => {
      const response = await patientsApi.analyze(id);
      return response.data;
    },
    onSuccess: () => {
      setShowAIAnalysis(true);
      toast.success('AI analysis complete');
    },
    onError: () => {
      toast.error('Analysis failed');
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
      </div>
    );
  }

  const patient = data?.patient;
  const conditions = data?.conditions;
  const medications = data?.medications;
  const observations = data?.observations;

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="mb-6">
        <Link to="/patients" className="text-sm text-slate-500 hover:text-slate-700 flex items-center gap-1 mb-4">
          <ArrowLeft className="w-4 h-4" />
          Back to Patients
        </Link>
        
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-primary-100 flex items-center justify-center">
              <User className="w-8 h-8 text-primary-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">{patient?.name}</h1>
              <p className="text-slate-500">Patient ID: {id}</p>
            </div>
          </div>
          
          <button 
            className="btn-primary"
            onClick={() => analyzeMutation.mutate()}
            disabled={analyzeMutation.isPending}
          >
            {analyzeMutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                Analyzing...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 mr-2" />
                AI Care Plan Match
              </>
            )}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Patient Info */}
        <div className="card p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">Patient Information</h2>
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <Calendar className="w-5 h-5 text-slate-400" />
              <div>
                <p className="text-sm text-slate-500">Date of Birth</p>
                <p className="font-medium">{patient?.birthDate || 'N/A'}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <User className="w-5 h-5 text-slate-400" />
              <div>
                <p className="text-sm text-slate-500">Gender</p>
                <p className="font-medium capitalize">{patient?.gender || 'N/A'}</p>
              </div>
            </div>
            {patient?.email && (
              <div className="flex items-center gap-3">
                <Mail className="w-5 h-5 text-slate-400" />
                <div>
                  <p className="text-sm text-slate-500">Email</p>
                  <p className="font-medium">{patient.email}</p>
                </div>
              </div>
            )}
            {patient?.phone && (
              <div className="flex items-center gap-3">
                <Phone className="w-5 h-5 text-slate-400" />
                <div>
                  <p className="text-sm text-slate-500">Phone</p>
                  <p className="font-medium">{patient.phone}</p>
                </div>
              </div>
            )}
            {patient?.address && (
              <div className="flex items-start gap-3">
                <MapPin className="w-5 h-5 text-slate-400 mt-0.5" />
                <div>
                  <p className="text-sm text-slate-500">Address</p>
                  <p className="font-medium">
                    {patient.address.line}<br />
                    {patient.address.city}, {patient.address.state} {patient.address.postalCode}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Conditions */}
        <div className="lg:col-span-2 card p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-slate-900">
              Conditions ({conditions?.total || 0})
            </h2>
          </div>
          
          {conditions?.items?.length > 0 ? (
            <div className="space-y-3">
              {conditions.items.map((condition, index) => (
                <div key={index} className="flex items-center justify-between p-3 rounded-lg bg-slate-50">
                  <div className="flex items-center gap-3">
                    <Activity className="w-5 h-5 text-slate-400" />
                    <div>
                      <p className="font-medium text-slate-900">{condition.display || 'Unknown Condition'}</p>
                      <p className="text-sm text-slate-500">
                        ICD-10: {condition.code || 'N/A'} • Status: {condition.status || 'active'}
                      </p>
                    </div>
                  </div>
                  <span className={`badge ${condition.status === 'active' ? 'badge-warning' : 'badge-success'}`}>
                    {condition.status || 'active'}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-slate-500 text-center py-8">No conditions on record</p>
          )}
        </div>

        {/* Medications */}
        <div className="card p-6">
          <div className="flex items-center gap-2 mb-4">
            <Pill className="w-5 h-5 text-slate-400" />
            <h2 className="text-lg font-semibold text-slate-900">
              Medications ({medications?.total || 0})
            </h2>
          </div>
          
          {medications?.items?.length > 0 ? (
            <div className="space-y-2">
              {medications.items.slice(0, 10).map((med, index) => (
                <div key={index} className="p-2 rounded bg-slate-50">
                  <p className="text-sm font-medium text-slate-900">{med.medication || 'Unknown'}</p>
                  <p className="text-xs text-slate-500">{med.status}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-slate-500 text-sm">No medications on record</p>
          )}
        </div>

        {/* Recent Observations */}
        <div className="lg:col-span-2 card p-6">
          <div className="flex items-center gap-2 mb-4">
            <FileText className="w-5 h-5 text-slate-400" />
            <h2 className="text-lg font-semibold text-slate-900">
              Recent Observations ({observations?.total || 0})
            </h2>
          </div>
          
          {observations?.items?.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {observations.items.map((obs, index) => (
                <div key={index} className="p-3 rounded-lg bg-slate-50 text-center">
                  <p className="text-2xl font-bold text-slate-900">
                    {obs.value || 'N/A'}
                    {obs.unit && <span className="text-sm font-normal text-slate-500 ml-1">{obs.unit}</span>}
                  </p>
                  <p className="text-sm text-slate-500 mt-1">{obs.code || 'Unknown'}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-slate-500 text-center py-4">No recent observations</p>
          )}
        </div>

        {/* AI Analysis Results */}
        {showAIAnalysis && analyzeMutation.data && (
          <div className="lg:col-span-3 card p-6">
            <div className="flex items-center gap-2 mb-4">
              <Sparkles className="w-5 h-5 text-purple-500" />
              <h2 className="text-lg font-semibold text-slate-900">AI Care Plan Analysis</h2>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* OpenAI Result */}
              <div className="p-4 rounded-lg bg-blue-50 border border-blue-200">
                <h3 className="font-medium text-blue-900 mb-2">OpenAI GPT-4 Analysis</h3>
                <pre className="text-sm text-blue-800 whitespace-pre-wrap">
                  {JSON.stringify(analyzeMutation.data?.analysis?.openai, null, 2)?.slice(0, 500)}
                </pre>
              </div>
              
              {/* Claude Result */}
              <div className="p-4 rounded-lg bg-orange-50 border border-orange-200">
                <h3 className="font-medium text-orange-900 mb-2">Claude Analysis</h3>
                <pre className="text-sm text-orange-800 whitespace-pre-wrap">
                  {JSON.stringify(analyzeMutation.data?.analysis?.claude, null, 2)?.slice(0, 500)}
                </pre>
              </div>
            </div>
            
            {analyzeMutation.data?.analysis?.selected && (
              <div className="mt-4 p-4 rounded-lg bg-green-50 border border-green-200">
                <h3 className="font-medium text-green-900 mb-2">
                  Selected Best Response: {analyzeMutation.data.analysis.selected.winner}
                </h3>
                <p className="text-sm text-green-800">
                  {analyzeMutation.data.analysis.selected.reasoning}
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
