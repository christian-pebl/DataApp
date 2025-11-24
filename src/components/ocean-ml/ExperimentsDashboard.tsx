'use client'

import { useState } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { FlaskConical, Box } from 'lucide-react'
import ModelsDashboard from './ModelsDashboard'
import ExperimentsTab from './ExperimentsTab'

export default function ExperimentsDashboard() {
  return (
    <div className="container mx-auto p-4 sm:p-6 space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">CV/ML Experiments</h1>
      </div>

      {/* Main Content */}
      <Tabs defaultValue="experiments" className="space-y-4">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="experiments" className="flex items-center gap-2">
            <FlaskConical className="h-4 w-4" />
            Experiments
          </TabsTrigger>
          <TabsTrigger value="models" className="flex items-center gap-2">
            <Box className="h-4 w-4" />
            Models
          </TabsTrigger>
        </TabsList>

        <TabsContent value="experiments" className="space-y-4">
          <ExperimentsTab />
        </TabsContent>

        <TabsContent value="models" className="space-y-4">
          <ModelsDashboard />
        </TabsContent>
      </Tabs>
    </div>
  )
}
