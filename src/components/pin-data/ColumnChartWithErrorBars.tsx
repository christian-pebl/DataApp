"use client";

import React from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell, ErrorBar } from 'recharts';
import type { SpotSampleGroup } from '@/lib/statistical-utils';

interface SpotSampleStyles {
  barGap?: number;
  barCategoryGap?: number;
  columnBorderWidth?: number;
  whiskerBoxWidth?: number;
  whiskerLineWidth?: number;
  whiskerBoxBorderWidth?: number;
  whiskerCapWidth?: number;
  chartMarginTop?: number;
  chartMarginRight?: number;
  chartMarginLeft?: number;
  chartMarginBottom?: number;
  errorBarWidth?: number;
  errorBarStrokeWidth?: number;
  xAxisLabelRotation?: number;
  xAxisLabelFontSize?: number;
  yAxisLabelFontSize?: number;
  yAxisTitleFontSize?: number;
  yAxisTitleFontWeight?: number | string;
  yAxisTitleAlign?: 'left' | 'center' | 'right';
  chartHeight?: number;
}

interface ColumnChartWithErrorBarsProps {
  data: SpotSampleGroup[];
  parameter: string;
  sampleIdColors: Record<string, string>;
  width?: number | string;
  height?: number;
  showXAxisLabels?: boolean;
  spotSampleStyles?: SpotSampleStyles;
  columnColorMode?: 'unique' | 'single';
  singleColumnColor?: string;
  yAxisRange?: { min?: number; max?: number };
}

/**
 * Column Chart with Error Bars for spot-sample data
 * Displays mean values with ± SD error bars
 * Single value samples show column without error bars
 */
export function ColumnChartWithErrorBars({
  data,
  parameter,
  sampleIdColors,
  width = "100%",
  height = 400,
  showXAxisLabels = true,
  spotSampleStyles,
  columnColorMode = 'single',
  singleColumnColor = '#3b82f6',
  yAxisRange
}: ColumnChartWithErrorBarsProps) {

  // Extract styling properties with defaults
  const styles = {
    barGap: spotSampleStyles?.barGap ?? 4,
    barCategoryGap: spotSampleStyles?.barCategoryGap ?? 10,
    columnBorderWidth: spotSampleStyles?.columnBorderWidth ?? 0,
    chartMarginTop: spotSampleStyles?.chartMarginTop ?? 20,
    chartMarginRight: spotSampleStyles?.chartMarginRight ?? 30,
    chartMarginLeft: spotSampleStyles?.chartMarginLeft ?? 40,
    chartMarginBottom: spotSampleStyles?.chartMarginBottom ?? 80,
    errorBarWidth: spotSampleStyles?.errorBarWidth ?? 4,
    errorBarStrokeWidth: spotSampleStyles?.errorBarStrokeWidth ?? 2,
    xAxisLabelRotation: spotSampleStyles?.xAxisLabelRotation ?? -45,
    xAxisLabelFontSize: spotSampleStyles?.xAxisLabelFontSize ?? 11,
    yAxisLabelFontSize: spotSampleStyles?.yAxisLabelFontSize ?? 12,
    yAxisTitleFontSize: spotSampleStyles?.yAxisTitleFontSize ?? 14,
    yAxisTitleFontWeight: spotSampleStyles?.yAxisTitleFontWeight ?? 'normal',
    yAxisTitleAlign: spotSampleStyles?.yAxisTitleAlign ?? 'center',
    chartHeight: spotSampleStyles?.chartHeight ?? 350
  };

  console.log('[COLUMN-CHART] Rendering for parameter:', parameter);
  console.log('[COLUMN-CHART] Total data groups:', data.length);
  console.log('[COLUMN-CHART] Sample colors:', sampleIdColors);
  console.log('[COLUMN-CHART] Applied styles:', styles);

  // Filter data for this parameter
  const parameterData = data.filter(d => d.parameter === parameter);

  console.log('[COLUMN-CHART] Filtered data for this parameter:', parameterData.length);
  console.log('[COLUMN-CHART] First 3 data points:', parameterData.slice(0, 3));

  if (parameterData.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        No data available for {parameter}
      </div>
    );
  }

  // Transform data for Recharts
  const chartData = parameterData.map((group, index) => {
    // FIX: Do NOT add offsets to mean/SD values - this corrupts the chart!
    // The uniqueness should be achieved through the xAxisLabel key only
    const result = {
      xAxisLabel: `${group.xAxisLabel}_${index}`, // Make x-axis label unique (this is the key)
      displayLabel: group.xAxisLabel, // Original label for display
      mean: group.stats.mean, // Use ACTUAL mean value for chart
      originalMean: group.stats.mean, // Keep original for tooltip
      sd: group.stats.sd, // Use ACTUAL SD
      originalSd: group.stats.sd, // Keep original for tooltip
      count: group.count,
      sampleId: group.sampleId,
      uniqueId: `${parameter}-${group.date}-${group.sampleId}-${index}`, // Unique identifier
      // Error bar data
      errorY: group.count > 1 ? [group.stats.sd, group.stats.sd] : [0, 0] // No error bars for single samples
    };

    // Log first 3 data transformations for debugging
    if (index < 3) {
      console.log(`[COLUMN-CHART-DATA] Bar ${index}:`, {
        xLabel: result.displayLabel,
        mean: result.mean,
        sd: result.sd,
        count: result.count,
        rawValues: group.values
      });
    }

    return result;
  });

  // Custom tooltip
  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload || payload.length === 0) return null;

    const data = payload[0].payload;

    return (
      <div className="bg-background border border-border rounded-lg p-3 shadow-lg">
        <p className="font-semibold text-sm mb-2">{data.displayLabel}</p>
        <p className="text-xs mb-1">
          <span className="text-muted-foreground">Sample ID:</span>{' '}
          <span className="font-medium">{data.sampleId}</span>
        </p>
        <p className="text-xs mb-1">
          <span className="text-muted-foreground">Mean:</span>{' '}
          <span className="font-medium">{data.originalMean.toFixed(2)}</span>
        </p>
        {data.count > 1 && (
          <>
            <p className="text-xs mb-1">
              <span className="text-muted-foreground">SD:</span>{' '}
              <span className="font-medium">±{data.originalSd.toFixed(2)}</span>
            </p>
            <p className="text-xs">
              <span className="text-muted-foreground">n =</span>{' '}
              <span className="font-medium">{data.count}</span>
            </p>
          </>
        )}
        {data.count === 1 && (
          <p className="text-xs text-muted-foreground">
            Single measurement
          </p>
        )}
      </div>
    );
  };

  // Custom X-axis tick (rotated for readability)
  const CustomXAxisTick = ({ x, y, payload }: any) => {
    // Extract the display label (remove the _index suffix)
    const displayValue = payload.value?.split('_').slice(0, -1).join('_') || payload.value;

    // Split label into date and sample ID (with subset if present)
    // Format: "DD/MM/YY [Sample-ID Subset]"
    const labelParts = displayValue.match(/^(.+?)\s+\[(.+?)\]$/);
    const dateLabel = labelParts ? labelParts[1] : displayValue;
    const sampleLabel = labelParts ? `[${labelParts[2]}]` : '';

    return (
      <g transform={`translate(${x},${y})`}>
        {/* Date on first line */}
        <text
          x={0}
          y={0}
          dy={16}
          textAnchor="end"
          fill="#666"
          fontSize={styles.xAxisLabelFontSize}
          transform={`rotate(${styles.xAxisLabelRotation})`}
        >
          {dateLabel}
        </text>
        {/* Sample ID (and subset) on second line */}
        {sampleLabel && (
          <text
            x={0}
            y={0}
            dy={16 + styles.xAxisLabelFontSize + 2}
            textAnchor="end"
            fill="#666"
            fontSize={styles.xAxisLabelFontSize}
            transform={`rotate(${styles.xAxisLabelRotation})`}
          >
            {sampleLabel}
          </text>
        )}
      </g>
    );
  };

  return (
    <ResponsiveContainer width={width} height={styles.chartHeight}>
      <BarChart
        data={chartData}
        margin={{
          top: styles.chartMarginTop,
          right: styles.chartMarginRight,
          left: styles.chartMarginLeft,
          bottom: styles.chartMarginBottom
        }}
        barGap={styles.barGap}
        barCategoryGap={`${styles.barCategoryGap}%`}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />

        <XAxis
          dataKey="xAxisLabel"
          height={styles.chartMarginBottom}
          tick={showXAxisLabels ? CustomXAxisTick : false}
          interval={0}
        />

        <YAxis
          label={{
            value: parameter,
            angle: -90,
            position: 'insideLeft',
            style: {
              fontSize: styles.yAxisTitleFontSize,
              fontWeight: styles.yAxisTitleFontWeight,
              textAnchor: 'middle' // SVG uses 'middle' for centering, not 'center'
            }
          }}
          tick={{ fontSize: styles.yAxisLabelFontSize }}
          domain={[
            yAxisRange?.min !== undefined ? yAxisRange.min : 'auto',
            yAxisRange?.max !== undefined ? yAxisRange.max : 'auto'
          ]}
        />

        <Tooltip content={<CustomTooltip />} />

        <Bar dataKey="mean" radius={[4, 4, 0, 0]}>
          {chartData.map((entry, index) => {
            // Use single color mode if selected, otherwise use unique colors per sample
            const color = columnColorMode === 'single'
              ? singleColumnColor
              : (sampleIdColors[entry.sampleId] || '#3b82f6');
            return (
              <Cell
                key={`cell-${entry.xAxisLabel}-${index}`}
                fill={color}
                stroke={styles.columnBorderWidth > 0 ? color : 'none'}
                strokeWidth={styles.columnBorderWidth}
              />
            );
          })}
          {/* Error bars - only rendered if sd > 0 */}
          <ErrorBar
            dataKey="errorY"
            width={styles.errorBarWidth}
            strokeWidth={styles.errorBarStrokeWidth}
            stroke="#666"
          />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
