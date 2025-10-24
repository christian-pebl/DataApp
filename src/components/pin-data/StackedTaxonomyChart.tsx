"use client";

import React from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, Cell } from 'recharts';
import type { AggregatedTaxonomyData } from '@/lib/edna-taxonomy-processor';

interface StackedTaxonomyChartProps {
  data: AggregatedTaxonomyData;
  fileName: string;
  customTitle?: string;
  customYAxisLabel?: string;
  phylumColors?: { [phylum: string]: string };
  width?: number | string;
  height?: number;
}

/**
 * Default color palette for common marine phyla
 * Following the spec: Chromista (browns), Metazoa (blues), Plantae (greens)
 */
const DEFAULT_PHYLUM_COLORS: { [key: string]: string } = {
  'Chromista': '#D4A574',      // Sandy brown
  'Metazoa': '#4A90E2',        // Ocean blue
  'Plantae': '#7CB342',        // Lime green
  'Annelida': '#E57373',       // Light red
  'Arthropoda': '#64B5F6',     // Light blue
  'Mollusca': '#9575CD',       // Purple
  'Chordata': '#4DB6AC',       // Teal
  'Echinodermata': '#FF8A65',  // Coral
  'Cnidaria': '#81C784',       // Green
  'Porifera': '#A1887F',       // Brown
  'Bryozoa': '#F06292',        // Pink
  'Platyhelminthes': '#FFB74D', // Orange
};

/**
 * Generate a color for a phylum not in the default palette
 * Uses a simple hash function for consistency
 */
function generatePhylumColor(phylum: string): string {
  let hash = 0;
  for (let i = 0; i < phylum.length; i++) {
    hash = phylum.charCodeAt(i) + ((hash << 5) - hash);
  }

  const hue = Math.abs(hash % 360);
  return `hsl(${hue}, 60%, 60%)`;
}

/**
 * Map phylum names to common descriptions for better user understanding
 */
const PHYLUM_COMMON_NAMES: { [key: string]: string } = {
  'Ochrophyta': 'Diatoms & Brown Algae',
  'Annelida': 'Segmented Worms',
  'Myzozoa': 'Dinoflagellates',
  'Arthropoda': 'Crustaceans',
  'Echinodermata': 'Sea Stars & Urchins',
  'Mollusca': 'Clams & Snails',
  'Chlorophyta': 'Green Algae',
  'Nematoda': 'Roundworms',
  'Cercozoa': 'Protists',
  'Haptophyta': 'Coccolithophores',
  'Chordata': 'Fish & Tunicates',
  'Cnidaria': 'Jellyfish & Corals',
  'Nemertea': 'Ribbon Worms',
  'Bigyra': 'Labyrinthulids',
  'Ciliophora': 'Ciliates',
  'Bryozoa': 'Moss Animals',
  'Platyhelminthes': 'Flatworms',
  'Porifera': 'Sponges'
};

/**
 * Get display name with common name in brackets
 */
function getPhylumDisplayName(phylum: string): string {
  const commonName = PHYLUM_COMMON_NAMES[phylum];
  return commonName ? `${phylum} (${commonName})` : phylum;
}

/**
 * Stacked Bar Chart for eDNA Taxonomy Composition
 *
 * Displays phylum-level community composition across multiple sampling sites
 * X-axis: Sample locations
 * Y-axis: Relative abundance (percentage)
 * Stacks: Different phyla with distinct colors
 */
export function StackedTaxonomyChart({
  data,
  fileName,
  customTitle = 'eDNA Phylum Composition',
  customYAxisLabel = 'Relative Abundance (%)',
  phylumColors,
  width = "100%",
  height = 600
}: StackedTaxonomyChartProps) {

  // Merge default colors with custom colors
  const colorPalette = { ...DEFAULT_PHYLUM_COLORS, ...phylumColors };

  // Get color for a phylum (use default, custom, or generate)
  const getPhylumColor = (phylum: string): string => {
    return colorPalette[phylum] || generatePhylumColor(phylum);
  };

  // Transform aggregated data into Recharts format
  // Each object represents one sample with percentages for each phylum
  const chartData = data.samples.map(sample => {
    const sampleData: any = { sample };

    // Add percentage for each phylum (using display names with common names)
    for (const phylum of data.allPhyla) {
      const displayName = getPhylumDisplayName(phylum);
      sampleData[displayName] = data.phylumPercentages[phylum][sample];
      // Also store the original phylum name for lookup
      sampleData[`_${displayName}_original`] = phylum;
    }

    // Add total count for tooltip
    sampleData._totalTaxa = data.totalTaxaPerSample[sample];

    return sampleData;
  });

  console.log('[STACKED-TAXONOMY-CHART] Rendering for file:', fileName);
  console.log('[STACKED-TAXONOMY-CHART] Samples:', data.samples);
  console.log('[STACKED-TAXONOMY-CHART] Phyla:', data.allPhyla);
  console.log('[STACKED-TAXONOMY-CHART] Chart data:', chartData);

  // Custom tooltip showing detailed breakdown
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const totalTaxa = payload[0]?.payload?._totalTaxa || 0;

      return (
        <div className="bg-white border border-gray-300 rounded shadow-lg p-3 max-w-xs">
          <p className="font-semibold text-sm mb-2">{label}</p>
          <p className="text-xs text-gray-600 mb-2">Total Taxa: {totalTaxa}</p>
          <div className="space-y-1 max-h-48 overflow-y-auto">
            {payload.map((entry: any, index: number) => {
              // Skip internal fields
              if (entry.dataKey.startsWith('_')) return null;

              const percentage = entry.value;
              // Extract original phylum name from the stored field
              const originalPhylum = entry.payload[`_${entry.dataKey}_original`];
              const count = data.phylumCounts[originalPhylum][label];

              return (
                <div key={index} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1">
                    <span
                      className="inline-block w-3 h-3 rounded"
                      style={{ backgroundColor: entry.fill }}
                    ></span>
                    <span className="font-medium">{entry.dataKey}:</span>
                  </div>
                  <span className="ml-2">
                    {count} ({percentage.toFixed(1)}%)
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      );
    }
    return null;
  };

  // Identify Control vs Farm sites (if naming convention matches)
  // ALGA_C_* = Control, ALGA_F_* = Farm
  const hasControlFarmPattern = data.samples.some(s => s.includes('_C_')) &&
                                 data.samples.some(s => s.includes('_F_'));

  // Calculate separator position (midpoint between control and farm)
  let separatorX = null;
  if (hasControlFarmPattern) {
    const controlSites = data.samples.filter(s => s.includes('_C_')).length;
    separatorX = controlSites - 0.5; // Position between last control and first farm
  }

  return (
    <div className="relative w-full" style={{ height }}>
      {/* Chart Title */}
      <div className="text-center mb-2">
        <h3 className="text-lg font-semibold text-gray-800">{customTitle}</h3>
      </div>

      {/* Stacked Bar Chart */}
      <ResponsiveContainer width={width} height={height - 60}>
        <BarChart
          data={chartData}
          margin={{ top: 40, right: 150, left: 60, bottom: 80 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />

          <XAxis
            dataKey="sample"
            label={{
              value: 'Sampling Location',
              position: 'insideBottom',
              offset: -15,
              style: { fontSize: '12px', fontWeight: 'normal' }
            }}
            tick={{ fontSize: 11, angle: -45, textAnchor: 'end' }}
            height={80}
          />

          <YAxis
            domain={[0, 100]}
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
            verticalAlign="middle"
            align="right"
            layout="vertical"
            wrapperStyle={{
              paddingLeft: '20px',
              fontSize: '12px'
            }}
            iconType="square"
            formatter={(value) => <span style={{ fontSize: '11px' }}>{value}</span>}
          />

          {/* Create a Bar component for each phylum */}
          {data.allPhyla.map((phylum, index) => {
            const displayName = getPhylumDisplayName(phylum);
            return (
              <Bar
                key={phylum}
                dataKey={displayName}
                name={displayName}
                stackId="a"
                fill={getPhylumColor(phylum)}
                radius={index === data.allPhyla.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]}
              />
            );
          })}

          {/* Add vertical separator line between Control and Farm sites if applicable */}
          {separatorX !== null && (
            <line
              x1={separatorX}
              y1={0}
              x2={separatorX}
              y2={height - 140}
              stroke="#999"
              strokeWidth={1}
              strokeDasharray="4 4"
            />
          )}
        </BarChart>
      </ResponsiveContainer>

      {/* Annotations for Control/Farm groupings - Commented out per user request */}
      {/* {hasControlFarmPattern && (
        <div className="absolute top-10 left-0 right-0 flex justify-around px-20">
          <div className="text-xs font-semibold text-gray-600 text-center">
            Control Sites
          </div>
          <div className="text-xs font-semibold text-gray-600 text-center">
            Farm Sites
          </div>
        </div>
      )} */}
    </div>
  );
}
