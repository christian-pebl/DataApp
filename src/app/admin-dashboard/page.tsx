"use client";

import React, { useState, useMemo } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import {
  Activity,
  TrendingUp,
  Clock,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Zap,
  Target,
  BarChart3,
  FileCode,
  ArrowUpRight,
  Trophy,
} from 'lucide-react';
import {
  generateDashboardData,
  formatTime,
  getStatusColor,
  getPriorityColor,
  type PerformanceMetric,
  type OptimizationOpportunity,
} from '@/lib/performance-metrics-parser';

export default function AdminDashboardPage() {
  const dashboardData = useMemo(() => generateDashboardData(), []);
  const [selectedTab, setSelectedTab] = useState('overview');
  const [selectedTier, setSelectedTier] = useState<number | 'all'>('all');

  // Filter optimizations by tier
  const filteredOptimizations = useMemo(() => {
    if (selectedTier === 'all') {
      return dashboardData.optimizations;
    }
    return dashboardData.optimizations.filter(opt => opt.tier === selectedTier);
  }, [dashboardData.optimizations, selectedTier]);

  // Sort optimizations by ROI
  const sortedOptimizations = useMemo(() => {
    return [...filteredOptimizations].sort((a, b) => b.roi - a.roi);
  }, [filteredOptimizations]);

  // Calculate tier statistics
  const tierStats = useMemo(() => {
    return {
      tier1: {
        count: dashboardData.optimizations.filter(o => o.tier === 1).length,
        totalEffort: dashboardData.optimizations
          .filter(o => o.tier === 1)
          .reduce((sum, o) => sum + o.implementationEffort, 0),
      },
      tier2: {
        count: dashboardData.optimizations.filter(o => o.tier === 2).length,
        totalEffort: dashboardData.optimizations
          .filter(o => o.tier === 2)
          .reduce((sum, o) => sum + o.implementationEffort, 0),
      },
      tier3: {
        count: dashboardData.optimizations.filter(o => o.tier === 3).length,
        totalEffort: dashboardData.optimizations
          .filter(o => o.tier === 3)
          .reduce((sum, o) => sum + o.implementationEffort, 0),
      },
    };
  }, [dashboardData.optimizations]);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b">
        <div className="container mx-auto px-6 py-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                Performance Dashboard
              </h1>
              <p className="text-gray-600 dark:text-gray-400 mt-2">
                Monitor test results, track performance metrics, and identify optimization opportunities
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-500">Last Updated</p>
              <p className="text-sm font-medium">
                {new Date(dashboardData.metadata.lastUpdated).toLocaleString()}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-6 py-8">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {/* Current Performance Score */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Current Performance</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {dashboardData.summary.currentPerformanceScore}%
              </div>
              <Progress value={dashboardData.summary.currentPerformanceScore} className="mt-2" />
              <p className="text-xs text-muted-foreground mt-2">
                {dashboardData.metadata.passingTests} of {dashboardData.metadata.totalTests} tests passing
              </p>
            </CardContent>
          </Card>

          {/* Potential Performance */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Potential Performance</CardTitle>
              <TrendingUp className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {dashboardData.summary.potentialPerformanceScore}%
              </div>
              <Progress value={dashboardData.summary.potentialPerformanceScore} className="mt-2" />
              <p className="text-xs text-muted-foreground mt-2">
                {dashboardData.summary.estimatedTotalImprovement} improvement possible
              </p>
            </CardContent>
          </Card>

          {/* Test Results */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Test Results</CardTitle>
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-green-600 flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3" />
                    Passing
                  </span>
                  <span className="text-sm font-bold">{dashboardData.metadata.passingTests}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-yellow-600 flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" />
                    Warning
                  </span>
                  <span className="text-sm font-bold">{dashboardData.metadata.warningTests}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-red-600 flex items-center gap-1">
                    <XCircle className="h-3 w-3" />
                    Failing
                  </span>
                  <span className="text-sm font-bold">{dashboardData.metadata.failingTests}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Quick Wins */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Quick Wins Available</CardTitle>
              <Zap className="h-4 w-4 text-yellow-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{dashboardData.summary.quickWins}</div>
              <p className="text-xs text-muted-foreground mt-2">
                Tier 1 optimizations (~{tierStats.tier1.totalEffort}h total)
              </p>
              <p className="text-xs text-green-600 font-medium mt-1">
                50-60% performance gain
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Main Content Tabs */}
        <Tabs value={selectedTab} onValueChange={setSelectedTab} className="space-y-6">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="tests">Test Results</TabsTrigger>
            <TabsTrigger value="optimizations">Optimizations</TabsTrigger>
            <TabsTrigger value="roadmap">Implementation Roadmap</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            {/* Critical Issues */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-red-600" />
                  Critical Performance Issues
                </CardTitle>
                <CardDescription>
                  Tests failing to meet performance targets
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {dashboardData.metrics
                    .filter(m => m.status === 'failing')
                    .map((metric, idx) => (
                      <div key={idx} className="border rounded-lg p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <h4 className="font-medium text-red-900 dark:text-red-100">
                              {metric.testName}
                            </h4>
                            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                              {metric.component} • {metric.file}
                            </p>
                            <div className="flex items-center gap-4 mt-3">
                              <div>
                                <span className="text-xs text-gray-500">Current</span>
                                <p className="text-lg font-bold text-red-600">
                                  {formatTime(metric.currentValue)}
                                </p>
                              </div>
                              <ArrowUpRight className="h-4 w-4 text-gray-400" />
                              <div>
                                <span className="text-xs text-gray-500">Target</span>
                                <p className="text-lg font-bold text-green-600">
                                  {formatTime(metric.targetValue)}
                                </p>
                              </div>
                              <div className="ml-auto">
                                <Badge variant="destructive">
                                  {metric.deltaPercentage}% over target
                                </Badge>
                              </div>
                            </div>
                            {metric.hasOptimization && (
                              <div className="mt-3 bg-blue-50 dark:bg-blue-900/20 p-3 rounded">
                                <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
                                  {metric.optimizationName}
                                </p>
                                <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">
                                  Expected: {metric.improvementPercentage}% faster • {metric.implementationEffort}h effort
                                </p>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>

            {/* Top Optimization Opportunities by ROI */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Trophy className="h-5 w-5 text-yellow-500" />
                  Top Optimization Opportunities (by ROI)
                </CardTitle>
                <CardDescription>
                  Best return on investment for implementation effort
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {sortedOptimizations.slice(0, 5).map((opt, idx) => (
                    <div key={idx} className="flex items-center gap-4 border rounded-lg p-3">
                      <div className="flex-shrink-0 w-12 h-12 rounded-full bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center text-white font-bold text-lg">
                        {idx + 1}
                      </div>
                      <div className="flex-1">
                        <h4 className="font-medium">{opt.name}</h4>
                        <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                          {opt.estimatedImprovement}
                        </p>
                      </div>
                      <div className="text-right">
                        <Badge className={getPriorityColor(opt.priority)}>
                          Tier {opt.tier}
                        </Badge>
                        <p className="text-xs text-gray-500 mt-1">
                          {opt.implementationEffort}h
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-bold text-green-600">
                          {opt.roi.toFixed(1)}
                        </p>
                        <p className="text-xs text-gray-500">ROI</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Test Results Tab */}
          <TabsContent value="tests">
            <Card>
              <CardHeader>
                <CardTitle>All Test Results</CardTitle>
                <CardDescription>
                  Complete list of performance tests and their current status
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Test Name</TableHead>
                      <TableHead>Component</TableHead>
                      <TableHead>Current</TableHead>
                      <TableHead>Target</TableHead>
                      <TableHead>Delta</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Optimization</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {dashboardData.metrics.map((metric, idx) => (
                      <TableRow key={idx} data-test-result data-test-status={metric.status}>
                        <TableCell className="font-medium">{metric.testName}</TableCell>
                        <TableCell>
                          <div>
                            <p className="text-sm">{metric.component}</p>
                            <p className="text-xs text-gray-500">{metric.file}</p>
                          </div>
                        </TableCell>
                        <TableCell className="font-mono">{formatTime(metric.currentValue)}</TableCell>
                        <TableCell className="font-mono">{formatTime(metric.targetValue)}</TableCell>
                        <TableCell>
                          <span className={`font-mono ${metric.deltaFromTarget > 0 ? 'text-red-600' : 'text-green-600'}`}>
                            {metric.deltaFromTarget > 0 ? '+' : ''}{metric.deltaPercentage}%
                          </span>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              metric.status === 'passing'
                                ? 'default'
                                : metric.status === 'warning'
                                ? 'secondary'
                                : 'destructive'
                            }
                          >
                            {metric.status === 'passing' && <CheckCircle2 className="h-3 w-3 mr-1" />}
                            {metric.status === 'warning' && <AlertTriangle className="h-3 w-3 mr-1" />}
                            {metric.status === 'failing' && <XCircle className="h-3 w-3 mr-1" />}
                            {metric.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {metric.hasOptimization ? (
                            <div className="text-sm">
                              <p className="font-medium text-green-600">
                                {metric.improvementPercentage}% faster
                              </p>
                              <p className="text-xs text-gray-500">{metric.implementationEffort}h</p>
                            </div>
                          ) : (
                            <span className="text-gray-400">N/A</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Optimizations Tab */}
          <TabsContent value="optimizations" className="space-y-6">
            {/* Tier Filter */}
            <div className="flex items-center gap-4">
              <span className="text-sm font-medium">Filter by Tier:</span>
              <div className="flex gap-2">
                <Button
                  variant={selectedTier === 'all' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSelectedTier('all')}
                >
                  All ({dashboardData.optimizations.length})
                </Button>
                <Button
                  variant={selectedTier === 1 ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSelectedTier(1)}
                >
                  Tier 1 ({tierStats.tier1.count})
                </Button>
                <Button
                  variant={selectedTier === 2 ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSelectedTier(2)}
                >
                  Tier 2 ({tierStats.tier2.count})
                </Button>
                <Button
                  variant={selectedTier === 3 ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSelectedTier(3)}
                >
                  Tier 3 ({tierStats.tier3.count})
                </Button>
              </div>
            </div>

            {/* Optimizations List */}
            <div className="space-y-4">
              {sortedOptimizations.map((opt, idx) => (
                <Card key={idx} data-priority={opt.priority}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <CardTitle className="text-lg">{opt.name}</CardTitle>
                        <CardDescription className="mt-2">{opt.description}</CardDescription>
                      </div>
                      <div className="flex gap-2">
                        <Badge className={getPriorityColor(opt.priority)}>
                          {opt.priority}
                        </Badge>
                        <Badge variant="outline">Tier {opt.tier}</Badge>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                      <div>
                        <p className="text-xs text-gray-500">Improvement</p>
                        <p className="text-sm font-medium text-green-600">{opt.estimatedImprovement}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Effort</p>
                        <p className="text-sm font-medium">{opt.implementationEffort}h</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">ROI</p>
                        <p className="text-sm font-medium text-blue-600">{opt.roi.toFixed(1)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Status</p>
                        <Badge variant={opt.implemented ? 'default' : 'secondary'}>
                          {opt.implemented ? 'Implemented' : 'Pending'}
                        </Badge>
                      </div>
                    </div>
                    <Separator className="my-4" />
                    <div>
                      <p className="text-xs text-gray-500 mb-2">Affected Metrics:</p>
                      <div className="flex flex-wrap gap-2">
                        {opt.affectedMetrics.map((metric, i) => (
                          <Badge key={i} variant="outline" className="text-xs">
                            {metric}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    <div className="mt-4">
                      <p className="text-xs text-gray-500">File Location:</p>
                      <code className="text-xs bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded mt-1 block">
                        {opt.file}
                        {opt.lineNumbers && `:${opt.lineNumbers}`}
                      </code>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* Implementation Roadmap Tab */}
          <TabsContent value="roadmap" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Implementation Roadmap</CardTitle>
                <CardDescription>
                  Phased approach to maximize performance gains
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Tier 1: Quick Wins */}
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <Zap className="h-5 w-5 text-yellow-500" />
                    <h3 className="text-lg font-semibold">Tier 1: Quick Wins</h3>
                    <Badge className="bg-green-100 text-green-800">
                      {tierStats.tier1.count} optimizations
                    </Badge>
                  </div>
                  <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg mb-4">
                    <div className="grid grid-cols-3 gap-4 text-center">
                      <div>
                        <p className="text-xs text-gray-600 dark:text-gray-400">Total Effort</p>
                        <p className="text-2xl font-bold text-green-600">
                          {tierStats.tier1.totalEffort}h
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-600 dark:text-gray-400">Expected Gain</p>
                        <p className="text-2xl font-bold text-green-600">50-60%</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-600 dark:text-gray-400">Timeline</p>
                        <p className="text-2xl font-bold text-green-600">Week 1</p>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    {dashboardData.optimizations
                      .filter(o => o.tier === 1)
                      .map((opt, idx) => (
                        <div key={idx} className="flex items-center gap-3 p-3 bg-white dark:bg-gray-800 rounded border">
                          <CheckCircle2 className="h-5 w-5 text-gray-400" />
                          <span className="flex-1 text-sm">{opt.name}</span>
                          <span className="text-xs text-gray-500">{opt.implementationEffort}h</span>
                        </div>
                      ))}
                  </div>
                </div>

                <Separator />

                {/* Tier 2: Core Improvements */}
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <Target className="h-5 w-5 text-blue-500" />
                    <h3 className="text-lg font-semibold">Tier 2: Core Improvements</h3>
                    <Badge className="bg-blue-100 text-blue-800">
                      {tierStats.tier2.count} optimizations
                    </Badge>
                  </div>
                  <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg mb-4">
                    <div className="grid grid-cols-3 gap-4 text-center">
                      <div>
                        <p className="text-xs text-gray-600 dark:text-gray-400">Total Effort</p>
                        <p className="text-2xl font-bold text-blue-600">
                          {tierStats.tier2.totalEffort}h
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-600 dark:text-gray-400">Cumulative Gain</p>
                        <p className="text-2xl font-bold text-blue-600">70-75%</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-600 dark:text-gray-400">Timeline</p>
                        <p className="text-2xl font-bold text-blue-600">Week 2-3</p>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    {dashboardData.optimizations
                      .filter(o => o.tier === 2)
                      .map((opt, idx) => (
                        <div key={idx} className="flex items-center gap-3 p-3 bg-white dark:bg-gray-800 rounded border">
                          <Clock className="h-5 w-5 text-gray-400" />
                          <span className="flex-1 text-sm">{opt.name}</span>
                          <span className="text-xs text-gray-500">{opt.implementationEffort}h</span>
                        </div>
                      ))}
                  </div>
                </div>

                <Separator />

                {/* Tier 3: Advanced Optimizations */}
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <TrendingUp className="h-5 w-5 text-purple-500" />
                    <h3 className="text-lg font-semibold">Tier 3: Advanced Optimizations</h3>
                    <Badge className="bg-purple-100 text-purple-800">
                      {tierStats.tier3.count} optimizations
                    </Badge>
                  </div>
                  <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-lg mb-4">
                    <div className="grid grid-cols-3 gap-4 text-center">
                      <div>
                        <p className="text-xs text-gray-600 dark:text-gray-400">Total Effort</p>
                        <p className="text-2xl font-bold text-purple-600">
                          {tierStats.tier3.totalEffort}h
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-600 dark:text-gray-400">Cumulative Gain</p>
                        <p className="text-2xl font-bold text-purple-600">80-85%</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-600 dark:text-gray-400">Timeline</p>
                        <p className="text-2xl font-bold text-purple-600">Week 4-5</p>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    {dashboardData.optimizations
                      .filter(o => o.tier === 3)
                      .map((opt, idx) => (
                        <div key={idx} className="flex items-center gap-3 p-3 bg-white dark:bg-gray-800 rounded border">
                          <FileCode className="h-5 w-5 text-gray-400" />
                          <span className="flex-1 text-sm">{opt.name}</span>
                          <span className="text-xs text-gray-500">{opt.implementationEffort}h</span>
                        </div>
                      ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
