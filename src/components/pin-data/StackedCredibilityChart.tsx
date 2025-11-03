"use client";

import React from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, Cell, LabelList } from 'recharts';
import type { AggregatedCredData } from '@/lib/edna-cred-processor';

interface StackedCredibilityChartProps {
  data: AggregatedCredData;
  fileName: string;
  customTitle?: string;
  customYAxisLabel?: string;
  gbifTrueColor?: string;
  gbifFalseColor?: string;
  width?: number | string;
  height?: number;
}

/**
 * Stacked Column Chart for eDNA Credibility Scores
 *
 * Displays species counts grouped by credibility level (Low/Moderate/High)
 * and stacked by GBIF validation status (TRUE/FALSE)
 */
export function StackedCredibilityChart({
  data,
  fileName,
  customTitle = 'Detection Credibility Score',
  customYAxisLabel = 'Species Count',
  gbifTrueColor = '#4CAF50', // Green for verified
  gbifFalseColor = '#FF9800', // Orange for unverified
  width = "100%",
  height = 400
}: StackedCredibilityChartProps) {

  // Transform aggregated data into Recharts format
  const chartData = [
    {
      category: 'Low',
      'GBIF Verified': data.low_gbif_true,
      'GBIF Unverified': data.low_gbif_false
    },
    {
      category: 'Moderate',
      'GBIF Verified': data.moderate_gbif_true,
      'GBIF Unverified': data.moderate_gbif_false
    },
    {
      category: 'High',
      'GBIF Verified': data.high_gbif_true,
      'GBIF Unverified': data.high_gbif_false
    }
  ];

  console.log('[STACKED-CRED-CHART] Rendering for file:', fileName);
  console.log('[STACKED-CRED-CHART] Chart data:', chartData);
  console.log('[STACKED-CRED-CHART] Total unique species:', data.totalUniqueSpecies);

  // Custom tooltip to show detailed counts
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const verified = payload[0]?.value || 0;
      const unverified = payload[1]?.value || 0;
      const total = verified + unverified;

      return (
        <div className="bg-white border border-gray-300 rounded shadow-lg p-3">
          <p className="font-semibold text-sm mb-1">{label} Credibility</p>
          <p className="text-sm text-green-700">
            <span className="inline-block w-3 h-3 mr-1 rounded" style={{ backgroundColor: gbifTrueColor }}></span>
            GBIF Verified: {verified}
          </p>
          <p className="text-sm text-orange-700">
            <span className="inline-block w-3 h-3 mr-1 rounded" style={{ backgroundColor: gbifFalseColor }}></span>
            GBIF Unverified: {unverified}
          </p>
          <p className="text-sm font-semibold mt-1 pt-1 border-t border-gray-200">
            Total: {total}
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="relative w-full" style={{ height }}>
      {/* Summary Overlay Box */}
      <div className="absolute top-8 left-1/2 transform -translate-x-1/2 z-10 bg-white/90 border border-gray-300 rounded-lg shadow-md px-4 py-2">
        <p className="text-sm font-semibold text-gray-700">
          Total Unique Species Detected = {data.totalUniqueSpecies}
        </p>
      </div>

      {/* Chart Title */}
      <div className="text-center mb-2">
        <h3 className="text-lg font-semibold text-gray-800">{customTitle}</h3>
      </div>

      {/* Stacked Bar Chart */}
      <ResponsiveContainer width={width} height={height - 80}>
        <BarChart
          data={chartData}
          margin={{ top: 60, right: 30, left: 50, bottom: 60 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis
            dataKey="category"
            label={{
              value: 'False Detection Frequency Category',
              position: 'insideBottom',
              offset: -10,
              style: { fontSize: '12px', fontWeight: 'normal' }
            }}
            tick={{ fontSize: 12 }}
          />
          <YAxis
            label={{
              value: customYAxisLabel,
              angle: -90,
              position: 'insideLeft',
              style: { fontSize: '14px', fontWeight: 'bold', textAnchor: 'middle' }
            }}
            tick={{ fontSize: 12 }}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend
            verticalAlign="bottom"
            height={36}
            wrapperStyle={{ paddingTop: '20px' }}
            iconType="square"
          />

          {/* GBIF Verified (Bottom of stack - Green) */}
          <Bar
            dataKey="GBIF Verified"
            stackId="a"
            fill={gbifTrueColor}
            radius={[0, 0, 0, 0]}
          >
            <LabelList
              dataKey="GBIF Verified"
              position="center"
              formatter={(value: number) => value > 0 ? value : ''}
              style={{ fontSize: 11, fill: '#fff', fontWeight: 600 }}
            />
          </Bar>

          {/* GBIF Unverified (Top of stack - Orange) */}
          <Bar
            dataKey="GBIF Unverified"
            stackId="a"
            fill={gbifFalseColor}
            radius={[4, 4, 0, 0]}
          >
            <LabelList
              dataKey="GBIF Unverified"
              position="center"
              formatter={(value: number) => value > 0 ? value : ''}
              style={{ fontSize: 11, fill: '#fff', fontWeight: 600 }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
