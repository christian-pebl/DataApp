"use client";

import React from 'react';
import type { SpotSampleGroup } from '@/lib/statistical-utils';

interface SpotSampleStyles {
  barGap?: number;
  barCategoryGap?: number;
  columnBorderWidth?: number;
  whiskerBoxWidth?: number;
  whiskerSpacing?: number; // Gap between whisker plot centers
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
  xAxisLabelSecondLineOffset?: number;
  xAxisShowDate?: boolean;
  xAxisShowStationName?: boolean;
  xAxisShowSampleId?: boolean;
  yAxisLabelFontSize?: number;
  yAxisTitleFontSize?: number;
  yAxisTitleFontWeight?: number | string;
  yAxisTitleAlign?: 'left' | 'center' | 'right';
  chartHeight?: number;
  chartWidth?: number; // Fixed chart width override
}

interface WhiskerPlotProps {
  data: SpotSampleGroup[];
  parameter: string;
  sampleIdColors: Record<string, string>;
  width?: number | string;
  height?: number;
  showXAxisLabels?: boolean;
  spotSampleStyles?: SpotSampleStyles;
}

/**
 * Whisker Plot (Box Plot) for spot-sample data using SVG
 * Displays min, Q1, median, Q3, max
 * Single value samples show as single dot
 */
export function WhiskerPlot({
  data,
  parameter,
  sampleIdColors,
  width = "100%",
  height = 400,
  showXAxisLabels = true,
  spotSampleStyles
}: WhiskerPlotProps) {

  // Extract styling properties with defaults
  const styles = {
    chartMarginTop: spotSampleStyles?.chartMarginTop ?? 20,
    chartMarginRight: spotSampleStyles?.chartMarginRight ?? 30,
    chartMarginLeft: spotSampleStyles?.chartMarginLeft ?? 60,
    chartMarginBottom: spotSampleStyles?.chartMarginBottom ?? (showXAxisLabels ? 140 : 40),
    xAxisLabelRotation: spotSampleStyles?.xAxisLabelRotation ?? -45,
    xAxisLabelFontSize: spotSampleStyles?.xAxisLabelFontSize ?? 11,
    xAxisLabelSecondLineOffset: spotSampleStyles?.xAxisLabelSecondLineOffset ?? 0,
    xAxisShowDate: spotSampleStyles?.xAxisShowDate ?? true,
    xAxisShowStationName: spotSampleStyles?.xAxisShowStationName ?? true,
    xAxisShowSampleId: spotSampleStyles?.xAxisShowSampleId ?? true,
    yAxisLabelFontSize: spotSampleStyles?.yAxisLabelFontSize ?? 12,
    yAxisTitleFontSize: spotSampleStyles?.yAxisTitleFontSize ?? 14,
    yAxisTitleFontWeight: spotSampleStyles?.yAxisTitleFontWeight ?? 'normal',
    yAxisTitleAlign: spotSampleStyles?.yAxisTitleAlign ?? 'center',
    chartHeight: spotSampleStyles?.chartHeight ?? 350,
    chartWidth: spotSampleStyles?.chartWidth,
    whiskerBoxWidth: spotSampleStyles?.whiskerBoxWidth ?? 40,
    whiskerLineWidth: spotSampleStyles?.whiskerLineWidth ?? 2,
    whiskerBoxBorderWidth: spotSampleStyles?.whiskerBoxBorderWidth ?? 2,
    whiskerCapWidth: spotSampleStyles?.whiskerCapWidth ?? 20
  };

  console.log('[WHISKER-PLOT] Rendering whisker plot for parameter:', parameter);
  console.log('[WHISKER-PLOT] Total data groups:', data.length);
  console.log('[WHISKER-PLOT] Sample ID colors:', sampleIdColors);
  console.log('[WHISKER-PLOT] Applied styles:', styles);

  // Filter data for this parameter
  const parameterData = data.filter(d => d.parameter === parameter);

  console.log('[WHISKER-PLOT] Filtered data for this parameter:', parameterData.length);

  if (parameterData.length === 0) {
    console.log('[WHISKER-PLOT] No data for parameter:', parameter);
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        No data available for {parameter}
      </div>
    );
  }

  // Helper function to calculate nice round tick values
  const calculateNiceTicks = (maxValue: number, minTicks = 6): number[] => {
    // Add minimal padding (2%) to ensure whisker caps aren't cut off
    const targetMax = maxValue * 1.02;

    // Calculate rough step size for desired number of ticks
    const roughStep = targetMax / (minTicks - 1);

    // Find the magnitude (power of 10)
    const magnitude = Math.pow(10, Math.floor(Math.log10(roughStep)));

    // Normalize the step to 1, 2, 4, 5, or 10 times the magnitude for more granular options
    const normalizedStep = roughStep / magnitude;
    let niceStep: number;

    if (normalizedStep <= 1) {
      niceStep = 1 * magnitude;
    } else if (normalizedStep <= 2) {
      niceStep = 2 * magnitude;
    } else if (normalizedStep <= 4) {
      niceStep = 4 * magnitude;
    } else if (normalizedStep <= 5) {
      niceStep = 5 * magnitude;
    } else {
      niceStep = 10 * magnitude;
    }

    // Generate ticks starting from 0
    const ticks: number[] = [0];
    let tick = niceStep;
    while (tick <= targetMax) {
      ticks.push(tick);
      tick += niceStep;
    }

    // Only add one more tick if we're significantly below targetMax
    // This prevents huge gaps while ensuring data fits
    if (ticks[ticks.length - 1] < targetMax) {
      ticks.push(tick);
    }

    // Ensure we have at least minTicks
    while (ticks.length < minTicks) {
      const lastTick = ticks[ticks.length - 1];
      ticks.push(lastTick + niceStep);
    }

    return ticks;
  };

  // Calculate Y-axis domain - always start at 0
  const allValues = parameterData.flatMap(d => [d.stats.min, d.stats.max]).filter(v => !isNaN(v) && isFinite(v));
  const dataMax = allValues.length > 0 ? Math.max(...allValues) : 1;
  const yMin = 0; // Always start at 0
  const yTicks = calculateNiceTicks(dataMax, 8); // At least 8 ticks for granular intervals
  const yMax = yTicks[yTicks.length - 1]; // Use the last tick as max
  const yRange = yMax - yMin;

  // Chart dimensions
  const chartHeight = styles.chartHeight;
  const margin = {
    top: styles.chartMarginTop,
    right: styles.chartMarginRight,
    bottom: styles.chartMarginBottom,
    left: styles.chartMarginLeft
  };

  // Calculate spacing and width
  let spacing: number;
  let plotWidth: number;
  let chartWidth: number;

  if (styles.chartWidth) {
    // Fixed chart width: calculate spacing to fit all whiskers
    chartWidth = styles.chartWidth;
    plotWidth = chartWidth - margin.left - margin.right;
    spacing = plotWidth / parameterData.length;
  } else {
    // Auto width: use whiskerSpacing setting
    spacing = styles.whiskerSpacing ?? 80;
    plotWidth = spacing * parameterData.length;
    chartWidth = plotWidth + margin.left + margin.right;
  }

  const plotHeight = chartHeight - margin.top - margin.bottom;

  // Scale functions - no padding, start at 0
  const scaleY = (value: number) => {
    const normalized = (value - yMin) / yRange;
    return plotHeight - (normalized * plotHeight);
  };

  // Use direct box width from styles
  const boxWidth = styles.whiskerBoxWidth;

  // Calculate whisker cap width based on percentage of box width
  const whiskerCapWidthPercent = styles.whiskerCapWidth / 100;

  console.log('[WHISKER-PLOT] 📏 Whisker dimensions:');
  console.log('  - whiskerBoxWidth:', boxWidth, 'px (directly set)');
  console.log('  - whiskerSpacing:', spacing, 'px', styles.chartWidth ? '(auto-calculated to fit)' : '(from settings)');
  console.log('  - whiskerLineWidth:', styles.whiskerLineWidth, 'px');
  console.log('  - whiskerBoxBorderWidth:', styles.whiskerBoxBorderWidth, 'px');
  console.log('  - whiskerCapWidth:', styles.whiskerCapWidth, '% of box width');
  console.log('  - number of boxes:', parameterData.length);
  console.log('[WHISKER-PLOT] 📊 Y-axis:');
  console.log('  - Y min:', yMin, '(always 0)');
  console.log('  - Y max:', yMax);
  console.log('  - Y ticks:', yTicks);
  console.log('  - Data max:', dataMax);
  console.log('[WHISKER-PLOT] 📐 Plot dimensions:');
  console.log('  - Chart width mode:', styles.chartWidth ? `Fixed (${styles.chartWidth}px)` : 'Auto');
  console.log('  - Plot width:', plotWidth, 'px');
  console.log('  - Total chart width:', chartWidth, 'px');

  // Tooltip state
  const [hoveredIndex, setHoveredIndex] = React.useState<number | null>(null);
  const [tooltipPos, setTooltipPos] = React.useState({ x: 0, y: 0 });

  const handleMouseEnter = (index: number, event: React.MouseEvent) => {
    setHoveredIndex(index);
    setTooltipPos({ x: event.clientX, y: event.clientY });
  };

  const handleMouseLeave = () => {
    setHoveredIndex(null);
  };

  return (
    <div className="relative w-full">
      <svg width="100%" height={chartHeight} viewBox={`0 0 ${chartWidth} ${chartHeight}`} preserveAspectRatio="xMidYMid meet">
        {/* Background */}
        <rect width={chartWidth} height={chartHeight} fill="transparent" />

        {/* Chart area */}
        <g transform={`translate(${margin.left},${margin.top})`}>
          {/* Grid lines and Y-axis ticks */}
          {yTicks.map((tickValue) => {
            const y = scaleY(tickValue);
            // Format tick value - show as integer if whole number, otherwise show decimal
            const formattedValue = tickValue % 1 === 0 ? tickValue.toString() : tickValue.toFixed(1);
            return (
              <g key={tickValue}>
                <line
                  x1={0}
                  y1={y}
                  x2={plotWidth}
                  y2={y}
                  stroke="#e0e0e0"
                  strokeDasharray="3 3"
                />
                <text
                  x={-10}
                  y={y}
                  textAnchor="end"
                  fontSize={styles.yAxisLabelFontSize}
                  fill="#666"
                  dominantBaseline="middle"
                >
                  {formattedValue}
                </text>
              </g>
            );
          })}

          {/* Left Y-axis vertical line */}
          <line
            x1={0}
            y1={0}
            x2={0}
            y2={plotHeight}
            stroke="#666"
            strokeWidth={1}
          />

          {/* Right Y-axis vertical line */}
          <line
            x1={plotWidth}
            y1={0}
            x2={plotWidth}
            y2={plotHeight}
            stroke="#666"
            strokeWidth={1}
          />

          {/* Y-axis label */}
          <text
            x={-plotHeight / 2}
            y={-45}
            transform={`rotate(-90, ${-plotHeight / 2}, -45)`}
            textAnchor="middle"
            fontSize={styles.yAxisTitleFontSize}
            fill="#000"
            fontWeight={styles.yAxisTitleFontWeight}
          >
            {parameter}
          </text>

          {/* Box plots */}
          {parameterData.map((group, index) => {
            const x = spacing * index + spacing / 2;
            const color = sampleIdColors[group.sampleId] || '#3b82f6';
            // Create unique key from group properties
            const uniqueKey = `${group.date}-${group.sampleId}-${group.bladeId || 'no-blade'}-${index}`;

            // Single value - draw dot
            if (group.count === 1) {
              const dotY = scaleY(group.stats.median);
              return (
                <g
                  key={uniqueKey}
                  onMouseEnter={(e) => handleMouseEnter(index, e as any)}
                  onMouseLeave={handleMouseLeave}
                  style={{ cursor: 'pointer' }}
                >
                  <circle
                    cx={x}
                    cy={dotY}
                    r={6}
                    fill={color}
                    stroke={color}
                    strokeWidth={styles.whiskerBoxBorderWidth}
                    opacity={hoveredIndex === index ? 1 : 0.8}
                  />
                </g>
              );
            }

            // Box plot
            const minY = scaleY(group.stats.min);
            const q1Y = scaleY(group.stats.Q1);
            const medianY = scaleY(group.stats.median);
            const q3Y = scaleY(group.stats.Q3);
            const maxY = scaleY(group.stats.max);

            return (
              <g
                key={uniqueKey}
                onMouseEnter={(e) => handleMouseEnter(index, e as any)}
                onMouseLeave={handleMouseLeave}
                style={{ cursor: 'pointer' }}
              >
                {/* Upper whisker */}
                <line
                  x1={x}
                  y1={maxY}
                  x2={x}
                  y2={q3Y}
                  stroke={color}
                  strokeWidth={styles.whiskerLineWidth}
                />
                {/* Upper whisker cap */}
                <line
                  x1={x - boxWidth * whiskerCapWidthPercent}
                  y1={maxY}
                  x2={x + boxWidth * whiskerCapWidthPercent}
                  y2={maxY}
                  stroke={color}
                  strokeWidth={styles.whiskerLineWidth}
                />

                {/* Box */}
                <rect
                  x={x - boxWidth / 2}
                  y={q3Y}
                  width={boxWidth}
                  height={q1Y - q3Y}
                  fill={`${color}40`}
                  stroke={color}
                  strokeWidth={styles.whiskerBoxBorderWidth}
                  opacity={hoveredIndex === index ? 1 : 0.8}
                />

                {/* Median line */}
                <line
                  x1={x - boxWidth / 2}
                  y1={medianY}
                  x2={x + boxWidth / 2}
                  y2={medianY}
                  stroke={color}
                  strokeWidth={styles.whiskerBoxBorderWidth + 1}
                />

                {/* Lower whisker */}
                <line
                  x1={x}
                  y1={q1Y}
                  x2={x}
                  y2={minY}
                  stroke={color}
                  strokeWidth={styles.whiskerLineWidth}
                />
                {/* Lower whisker cap */}
                <line
                  x1={x - boxWidth * whiskerCapWidthPercent}
                  y1={minY}
                  x2={x + boxWidth * whiskerCapWidthPercent}
                  y2={minY}
                  stroke={color}
                  strokeWidth={styles.whiskerLineWidth}
                />
              </g>
            );
          })}

          {/* X-axis */}
          <line
            x1={0}
            y1={plotHeight}
            x2={plotWidth}
            y2={plotHeight}
            stroke="#666"
            strokeWidth={1}
          />

          {/* X-axis labels */}
          {showXAxisLabels && parameterData.map((group, index) => {
            const x = spacing * index + spacing / 2;
            // Create unique key from group properties
            const uniqueKey = `label-${group.date}-${group.sampleId}-${group.bladeId || 'no-blade'}-${index}`;

            // Split label into date and sample info
            // Format: "DD/MM/YY [Station-Name Sample-ID]" or "DD/MM/YY [Sample-ID]"
            const labelParts = group.xAxisLabel.match(/^(.+?)\s+\[(.+?)\]$/);
            const dateLabel = labelParts ? labelParts[1] : group.xAxisLabel;
            const bracketContent = labelParts ? labelParts[2] : '';

            // Try to split bracket content into station name and sample ID
            const bracketParts = bracketContent.split(' ');
            const stationName = bracketParts.length > 1 ? bracketParts[0] : '';
            const sampleId = bracketParts.length > 1 ? bracketParts[1] : bracketContent;

            // Build label components based on toggle settings
            const labelComponents: string[] = [];
            if (styles.xAxisShowDate && dateLabel) {
              labelComponents.push(dateLabel);
            }
            if (styles.xAxisShowStationName && stationName) {
              labelComponents.push(stationName);
            }
            if (styles.xAxisShowSampleId && sampleId) {
              labelComponents.push(sampleId);
            }

            // Calculate line breaks - show first part on line 1, rest on line 2
            const firstLine = labelComponents[0] || '';
            const secondLine = labelComponents.slice(1).join(' ');

            const secondLineOffset = styles.xAxisLabelSecondLineOffset || 0;
            const secondLineX = x + secondLineOffset;
            const secondLineY = plotHeight + 15 + styles.xAxisLabelFontSize + 2;

            return (
              <g key={uniqueKey}>
                {/* First line */}
                {firstLine && (
                  <text
                    x={x}
                    y={plotHeight + 15}
                    textAnchor="end"
                    fontSize={styles.xAxisLabelFontSize}
                    fill="#666"
                    transform={`rotate(${styles.xAxisLabelRotation}, ${x}, ${plotHeight + 15})`}
                  >
                    {firstLine}
                  </text>
                )}
                {/* Second line */}
                {secondLine && (
                  <text
                    x={secondLineX}
                    y={secondLineY}
                    textAnchor="end"
                    fontSize={styles.xAxisLabelFontSize}
                    fill="#666"
                    transform={`rotate(${styles.xAxisLabelRotation}, ${secondLineX}, ${secondLineY})`}
                  >
                    {secondLine}
                  </text>
                )}
                {/* Placeholder if nothing to show */}
                {!firstLine && !secondLine && (
                  <text
                    x={x}
                    y={plotHeight + 15}
                    textAnchor="end"
                    fontSize={styles.xAxisLabelFontSize}
                    fill="#999"
                    transform={`rotate(${styles.xAxisLabelRotation}, ${x}, ${plotHeight + 15})`}
                  >
                    -
                  </text>
                )}
              </g>
            );
          })}
        </g>
      </svg>

      {/* Tooltip */}
      {hoveredIndex !== null && (
        <div
          className="fixed bg-background border border-border rounded-lg p-3 shadow-lg z-50 pointer-events-none"
          style={{
            left: tooltipPos.x + 10,
            top: tooltipPos.y + 10
          }}
        >
          <p className="font-semibold text-sm mb-2">{parameterData[hoveredIndex].xAxisLabel}</p>
          <p className="text-xs mb-1">
            <span className="text-muted-foreground">Sample ID:</span>{' '}
            <span className="font-medium">{parameterData[hoveredIndex].sampleId}</span>
          </p>

          {parameterData[hoveredIndex].count > 1 ? (
            <>
              <p className="text-xs mb-1">
                <span className="text-muted-foreground">Max:</span>{' '}
                <span className="font-medium">{parameterData[hoveredIndex].stats.max.toFixed(2)}</span>
              </p>
              <p className="text-xs mb-1">
                <span className="text-muted-foreground">Q3:</span>{' '}
                <span className="font-medium">{parameterData[hoveredIndex].stats.Q3.toFixed(2)}</span>
              </p>
              <p className="text-xs mb-1">
                <span className="text-muted-foreground">Median:</span>{' '}
                <span className="font-medium">{parameterData[hoveredIndex].stats.median.toFixed(2)}</span>
              </p>
              <p className="text-xs mb-1">
                <span className="text-muted-foreground">Q1:</span>{' '}
                <span className="font-medium">{parameterData[hoveredIndex].stats.Q1.toFixed(2)}</span>
              </p>
              <p className="text-xs mb-1">
                <span className="text-muted-foreground">Min:</span>{' '}
                <span className="font-medium">{parameterData[hoveredIndex].stats.min.toFixed(2)}</span>
              </p>
              <p className="text-xs">
                <span className="text-muted-foreground">n =</span>{' '}
                <span className="font-medium">{parameterData[hoveredIndex].count}</span>
              </p>
            </>
          ) : (
            <>
              <p className="text-xs mb-1">
                <span className="text-muted-foreground">Value:</span>{' '}
                <span className="font-medium">{parameterData[hoveredIndex].stats.median.toFixed(2)}</span>
              </p>
              <p className="text-xs text-muted-foreground">
                Single measurement
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
