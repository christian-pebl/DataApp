'use client';

import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from "@/hooks/use-toast";
import { Plus, Loader2 } from 'lucide-react';
import { projectService } from '@/lib/supabase/project-service';

export interface AddProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onProjectCreated?: () => Promise<void>;
}

export function AddProjectDialog({
  open,
  onOpenChange,
  onProjectCreated,
}: AddProjectDialogProps) {
  const { toast } = useToast();
  const [newProjectName, setNewProjectName] = React.useState('');
  const [newProjectDescription, setNewProjectDescription] = React.useState('');
  const [isCreatingProject, setIsCreatingProject] = React.useState(false);

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setNewProjectName('');
      setNewProjectDescription('');
    }
    onOpenChange(newOpen);
  };

  const handleCreateProject = async () => {
    console.log('🔄 Create Project button clicked');
    console.log('📝 Project name:', newProjectName);
    console.log('📝 Project description:', newProjectDescription);

    if (!newProjectName.trim()) {
      console.log('❌ Project name is empty, aborting');
      return;
    }

    console.log('⏳ Setting isCreatingProject to true');
    setIsCreatingProject(true);
    try {
      console.log('🚀 Calling projectService.createProject...');
      const newProject = await projectService.createProject({
        name: newProjectName.trim(),
        description: newProjectDescription.trim() || undefined
      });
      console.log('✅ Project created successfully:', newProject);

      toast({
        title: "Project Created",
        description: `"${newProject.name}" has been created successfully.`,
        duration: 3000
      });

      onOpenChange(false);
      setNewProjectName('');
      setNewProjectDescription('');

      // Refresh project list to show new project
      console.log('🔄 Refreshing project list after creation...');
      if (onProjectCreated) {
        await onProjectCreated();
      }

    } catch (error) {
      console.error('Failed to create project:', error);
      toast({
        title: "Creation Failed",
        description: error instanceof Error ? error.message : "Failed to create project. Please try again.",
        variant: "destructive",
        duration: 5000
      });
    } finally {
      setIsCreatingProject(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5" />
            Add New Project
          </DialogTitle>
          <DialogDescription>
            Create a new project to organize your pins, lines, and areas.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Project Name */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Project Name *</label>
            <Input
              value={newProjectName}
              onChange={(e) => setNewProjectName(e.target.value)}
              placeholder="Enter project name"
              required
            />
          </div>

          {/* Project Description */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Description</label>
            <Textarea
              value={newProjectDescription}
              onChange={(e) => setNewProjectDescription(e.target.value)}
              placeholder="Optional description"
              rows={3}
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-4">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateProject}
              disabled={!newProjectName.trim() || isCreatingProject}
            >
              {isCreatingProject && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {isCreatingProject ? 'Creating...' : 'Create Project'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
