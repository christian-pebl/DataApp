'use client';

import React, { useState, useEffect } from 'react';
import MotionAnalysisDashboard from '@/components/motion-analysis/MotionAnalysisDashboard';
import { Loader2 } from 'lucide-react';

// Example: Load motion analysis data from JSON files
async function loadMotionAnalysisData() {
  // In production, this would load from your backend API
  // For now, we'll demonstrate with a mock data loader

  const files = [
    'SUBCAM_ALG_2020-01-26_09-00-40_background_subtracted_motion_analysis.json',
    'SUBCAM_ALG_2020-01-27_12-00-40_background_subtracted_motion_analysis.json',
    'SUBCAM_ALG_2020-01-29_09-00-40_background_subtracted_motion_analysis.json',
    'SUBCAM_ALG_2020-02-01_09-00-41_background_subtracted_motion_analysis.json',
    'SUBCAM_ALG_2020-02-02_12-00-40_background_subtracted_motion_analysis.json',
    'SUBCAM_ALG_2020-02-03_09-00-41_background_subtracted_motion_analysis.json',
    'SUBCAM_ALG_2020-02-08_09-00-41_background_subtracted_motion_analysis.json',
    'algapelago_1_2025-06-20_14-00-48_background_subtracted_motion_analysis.json',
    'algapelago_1_2025-06-21_10-00-48_background_subtracted_motion_analysis.json',
    'algapelago_1_2025-06-21_12-00-48_background_subtracted_motion_analysis.json',
  ];

  const results = [];

  for (const file of files) {
    try {
      const response = await fetch(`/motion-analysis-results/${file}`);
      if (response.ok) {
        const data = await response.json();
        results.push(data);
      }
    } catch (error) {
      console.error(`Failed to load ${file}:`, error);
    }
  }

  return results;
}

export default function MotionAnalysisPage() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      setLoading(true);
      const results = await loadMotionAnalysisData();

      if (results.length === 0) {
        setError('No motion analysis data found. Please run the CV pipeline first.');
        return;
      }

      setData(results);
    } catch (err) {
      setError('Failed to load motion analysis data');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-blue-600" />
          <p className="text-gray-600">Loading motion analysis data...</p>
        </div>
      </div>
    );
  }

  if (error || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center max-w-md">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">No Data Available</h2>
          <p className="text-gray-600 mb-6">
            {error || 'No motion analysis results found. Please run the CV pipeline to generate data.'}
          </p>
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-left">
            <p className="text-sm font-medium text-gray-700 mb-2">To generate data:</p>
            <ol className="text-sm text-gray-600 space-y-1">
              <li>1. Place videos in <code className="bg-gray-200 px-1 rounded">input/</code> directory</li>
              <li>2. Run: <code className="bg-gray-200 px-1 rounded">python cv_scripts/batch_process_videos.py</code></li>
              <li>3. Copy JSON results to <code className="bg-gray-200 px-1 rounded">public/motion-analysis-results/</code></li>
              <li>4. Refresh this page</li>
            </ol>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <MotionAnalysisDashboard data={data} />
    </div>
  );
}
