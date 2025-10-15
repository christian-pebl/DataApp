import { useState, useEffect, useMemo } from 'react';

interface LoadingStage {
  name: string;
  progress: number;
  isComplete: boolean;
}

interface UsePageLoadingStateProps {
  isLoadingProjects: boolean;
  isLoadingActiveProject: boolean;
  isLoadingPinMeteoData: boolean;
  isDataLoading: boolean;
  isUploadingFiles?: boolean;
}

export function usePageLoadingState({
  isLoadingProjects,
  isLoadingActiveProject,
  isLoadingPinMeteoData,
  isDataLoading,
  isUploadingFiles = false,
}: UsePageLoadingStateProps) {
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [completedStages, setCompletedStages] = useState(new Set<string>());

  // Define loading stages
  const stages: LoadingStage[] = useMemo(() => [
    {
      name: 'projects',
      progress: 25,
      isComplete: !isLoadingProjects && !isLoadingActiveProject
    },
    {
      name: 'data',
      progress: 50,
      isComplete: !isLoadingPinMeteoData
    },
    {
      name: 'visualization',
      progress: 75,
      isComplete: !isDataLoading
    },
    {
      name: 'complete',
      progress: 100,
      isComplete: true
    },
  ], [isLoadingProjects, isLoadingActiveProject, isLoadingPinMeteoData, isDataLoading]);

  // Calculate current stage and progress
  const currentStage = useMemo(() => {
    return stages.find(stage => !stage.isComplete) || stages[stages.length - 1];
  }, [stages]);

  const progress = useMemo(() => {
    const completedCount = stages.filter(s => s.isComplete).length;
    return Math.round((completedCount / stages.length) * 100);
  }, [stages]);

  const isLoading = useMemo(() => {
    return isLoadingProjects ||
           isLoadingActiveProject ||
           isLoadingPinMeteoData ||
           isDataLoading ||
           isUploadingFiles;
  }, [isLoadingProjects, isLoadingActiveProject, isLoadingPinMeteoData, isDataLoading, isUploadingFiles]);

  // Track when loading completes
  useEffect(() => {
    if (!isLoading && isInitialLoad) {
      // Wait 500ms after complete, then mark initial load as done
      const timer = setTimeout(() => {
        setIsInitialLoad(false);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [isLoading, isInitialLoad]);

  // Track completed stages
  useEffect(() => {
    const newCompleted = new Set(completedStages);
    stages.forEach(stage => {
      if (stage.isComplete && stage.name !== 'complete') {
        newCompleted.add(stage.name);
      }
    });
    setCompletedStages(newCompleted);
  }, [stages]);

  return {
    isLoading,
    isInitialLoad,
    progress,
    currentStage: currentStage.name,
    stageProgress: currentStage.progress,
    completedStages,
  };
}
