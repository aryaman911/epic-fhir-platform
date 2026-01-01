import React, { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Sparkles, Send, Loader2, CheckCircle, Trophy } from 'lucide-react';
import { aiApi } from '../../services/api';
import toast from 'react-hot-toast';

export default function AIPlaygroundPage() {
  const [prompt, setPrompt] = useState('');
  const [systemPrompt, setSystemPrompt] = useState('You are a healthcare analytics expert. Provide clinical insights based on patient data.');
  const [results, setResults] = useState(null);

  const compareMutation = useMutation({
    mutationFn: async () => {
      const response = await aiApi.compare(prompt, systemPrompt);
      return response.data;
    },
    onSuccess: (data) => {
      setResults(data);
      toast.success('AI comparison complete');
    },
    onError: () => {
      toast.error('AI analysis failed');
    },
  });

  const analyzeMutation = useMutation({
    mutationFn: async () => {
      const response = await aiApi.analyze(prompt, systemPrompt, true);
      return response.data;
    },
    onSuccess: (data) => {
      setResults(data);
      toast.success('Analysis complete with best selection');
    },
  });

  const presetPrompts = [
    {
      label: 'Diabetes Care Plan Match',
      prompt: 'A 58-year-old female patient with ICD-10 codes E11.9 (Type 2 diabetes without complications) and I10 (Essential hypertension). Recent HbA1c: 8.2%. BMI: 32. What care plans would benefit this patient?',
    },
    {
      label: 'Risk Stratification',
      prompt: 'Analyze the following patient for risk level: 72-year-old male with heart failure (I50.9), COPD (J44.9), and CKD stage 3 (N18.3). Recent ED visit for shortness of breath.',
    },
    {
      label: 'Outreach Letter',
      prompt: 'Write a personalized outreach letter inviting a patient named John Smith to enroll in our Diabetes Management Program. The program includes monthly check-ins, CGM monitoring, and nutrition counseling.',
    },
  ];

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <h1 className="page-title flex items-center gap-2">
          <Sparkles className="w-8 h-8 text-purple-500" />
          AI Playground
        </h1>
        <p className="page-subtitle">Compare OpenAI GPT-4 and Claude AI responses side by side</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Input Panel */}
        <div className="lg:col-span-1 space-y-6">
          {/* System Prompt */}
          <div className="card p-6">
            <label className="label">System Prompt</label>
            <textarea
              className="input h-24 resize-none"
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              placeholder="Define the AI's role and behavior..."
            />
          </div>

          {/* User Prompt */}
          <div className="card p-6">
            <label className="label">Your Prompt</label>
            <textarea
              className="input h-40 resize-none"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Enter your healthcare analysis prompt..."
            />
            
            <div className="flex gap-3 mt-4">
              <button
                className="btn-primary flex-1"
                onClick={() => compareMutation.mutate()}
                disabled={!prompt || compareMutation.isPending}
              >
                {compareMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <Send className="w-4 h-4 mr-2" />
                )}
                Compare Both
              </button>
              <button
                className="btn-secondary flex-1"
                onClick={() => analyzeMutation.mutate()}
                disabled={!prompt || analyzeMutation.isPending}
              >
                {analyzeMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <Trophy className="w-4 h-4 mr-2" />
                )}
                Select Best
              </button>
            </div>
          </div>

          {/* Preset Prompts */}
          <div className="card p-6">
            <h3 className="font-medium text-slate-900 mb-3">Quick Prompts</h3>
            <div className="space-y-2">
              {presetPrompts.map((preset, index) => (
                <button
                  key={index}
                  className="w-full text-left p-3 rounded-lg bg-slate-50 hover:bg-slate-100 transition-colors"
                  onClick={() => setPrompt(preset.prompt)}
                >
                  <p className="font-medium text-slate-900">{preset.label}</p>
                  <p className="text-sm text-slate-500 line-clamp-2">{preset.prompt}</p>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Results Panel */}
        <div className="lg:col-span-2 space-y-6">
          {results ? (
            <>
              {/* OpenAI Result */}
              <div className="card overflow-hidden">
                <div className="px-6 py-4 bg-blue-50 border-b border-blue-100 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-blue-500 flex items-center justify-center">
                      <span className="text-white font-bold text-sm">AI</span>
                    </div>
                    <h3 className="font-semibold text-blue-900">OpenAI GPT-4</h3>
                  </div>
                  {results.selected?.winner === 'openai' && (
                    <span className="badge bg-blue-200 text-blue-800 flex items-center gap-1">
                      <Trophy className="w-3 h-3" /> Winner
                    </span>
                  )}
                </div>
                <div className="p-6">
                  {results.openai?.error ? (
                    <p className="text-red-600">{results.openai.error}</p>
                  ) : (
                    <div className="prose prose-sm max-w-none">
                      <pre className="whitespace-pre-wrap text-sm text-slate-700 font-sans">
                        {results.openai?.content}
                      </pre>
                    </div>
                  )}
                  {results.openai?.usage && (
                    <p className="text-xs text-slate-400 mt-4">
                      Tokens: {results.openai.usage.prompt_tokens} in / {results.openai.usage.completion_tokens} out
                    </p>
                  )}
                </div>
              </div>

              {/* Claude Result */}
              <div className="card overflow-hidden">
                <div className="px-6 py-4 bg-orange-50 border-b border-orange-100 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-orange-500 flex items-center justify-center">
                      <span className="text-white font-bold text-sm">C</span>
                    </div>
                    <h3 className="font-semibold text-orange-900">Claude AI</h3>
                  </div>
                  {results.selected?.winner === 'claude' && (
                    <span className="badge bg-orange-200 text-orange-800 flex items-center gap-1">
                      <Trophy className="w-3 h-3" /> Winner
                    </span>
                  )}
                </div>
                <div className="p-6">
                  {results.claude?.error ? (
                    <p className="text-red-600">{results.claude.error}</p>
                  ) : (
                    <div className="prose prose-sm max-w-none">
                      <pre className="whitespace-pre-wrap text-sm text-slate-700 font-sans">
                        {results.claude?.content}
                      </pre>
                    </div>
                  )}
                  {results.claude?.usage && (
                    <p className="text-xs text-slate-400 mt-4">
                      Tokens: {results.claude.usage.input_tokens} in / {results.claude.usage.output_tokens} out
                    </p>
                  )}
                </div>
              </div>

              {/* Selection Reasoning */}
              {results.selected && (
                <div className="card p-6 bg-green-50 border-green-200">
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle className="w-5 h-5 text-green-600" />
                    <h3 className="font-semibold text-green-900">
                      Best Response Selected: {results.selected.winner}
                    </h3>
                  </div>
                  <p className="text-sm text-green-800">{results.selected.reasoning}</p>
                </div>
              )}
            </>
          ) : (
            <div className="card p-12 text-center">
              <Sparkles className="w-16 h-16 text-slate-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-slate-900 mb-2">Ready to Analyze</h3>
              <p className="text-slate-500">
                Enter a prompt and click "Compare Both" to see AI responses from OpenAI and Claude side by side
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
