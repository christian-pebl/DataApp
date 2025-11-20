'use client'

import { useState } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Video, GraduationCap } from 'lucide-react'
import VideoLibrary from './VideoLibrary'
import TrainingDashboard from './TrainingDashboard'

export default function OceanMLDashboard() {
  return (
    <div className="container mx-auto p-4 sm:p-6 space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">SUBCAM Data Processing</h1>
      </div>

      {/* Main Content */}
      <Tabs defaultValue="videos" className="space-y-4">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="videos" className="flex items-center gap-2">
            <Video className="h-4 w-4" />
            Videos
          </TabsTrigger>
          <TabsTrigger value="training" className="flex items-center gap-2">
            <GraduationCap className="h-4 w-4" />
            Training
          </TabsTrigger>
        </TabsList>

        <TabsContent value="videos" className="space-y-4">
          <VideoLibrary />
        </TabsContent>

        <TabsContent value="training" className="space-y-4">
          <TrainingDashboard />
        </TabsContent>
      </Tabs>
    </div>
  )
}
