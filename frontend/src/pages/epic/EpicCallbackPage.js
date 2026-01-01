import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Loader2, CheckCircle, XCircle } from 'lucide-react';
import { authApi } from '../../services/api';
import toast from 'react-hot-toast';

export default function EpicCallbackPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState('processing');
  const [error, setError] = useState(null);

  useEffect(() => {
    const handleCallback = async () => {
      const code = searchParams.get('code');
      const state = searchParams.get('state');
      const errorParam = searchParams.get('error');

      if (errorParam) {
        setStatus('error');
        setError(searchParams.get('error_description') || 'Authorization failed');
        return;
      }

      if (!code) {
        setStatus('error');
        setError('No authorization code received');
        return;
      }

      try {
        await authApi.epicCallback(code, state);
        setStatus('success');
        toast.success('EPIC connected successfully!');
        setTimeout(() => navigate('/settings'), 2000);
      } catch (err) {
        setStatus('error');
        setError(err.response?.data?.error || 'Failed to complete EPIC authorization');
      }
    };

    handleCallback();
  }, [searchParams, navigate]);

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="card p-8 text-center max-w-md w-full">
        {status === 'processing' && (
          <>
            <Loader2 className="w-16 h-16 text-primary-600 animate-spin mx-auto mb-4" />
            <h1 className="text-xl font-bold text-slate-900 mb-2">Connecting to EPIC</h1>
            <p className="text-slate-500">Please wait while we complete the authorization...</p>
          </>
        )}

        {status === 'success' && (
          <>
            <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
            <h1 className="text-xl font-bold text-slate-900 mb-2">Connected!</h1>
            <p className="text-slate-500">Your EPIC account is now connected. Redirecting...</p>
          </>
        )}

        {status === 'error' && (
          <>
            <XCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
            <h1 className="text-xl font-bold text-slate-900 mb-2">Connection Failed</h1>
            <p className="text-red-600 mb-4">{error}</p>
            <button 
              className="btn-primary"
              onClick={() => navigate('/settings')}
            >
              Back to Settings
            </button>
          </>
        )}
      </div>
    </div>
  );
}
