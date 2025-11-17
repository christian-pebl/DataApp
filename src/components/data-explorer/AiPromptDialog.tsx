'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Sparkles, History, Trash2, Clock } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { ScrollArea } from '@/components/ui/scroll-area';

interface AiPromptDialogProps {
  isOpen: boolean;
  onClose: () => void;
  selectedCellCount: number;
  onSubmit: (prompt: string) => Promise<void>;
  isProcessing?: boolean;
}

interface PromptHistoryEntry {
  prompt: string;
  timestamp: number;
  useCount: number;
}

const PROMPT_HISTORY_KEY = 'ai-prompt-history';
const MAX_HISTORY_ITEMS = 20;

// Helper function to format timestamp
const formatTimestamp = (timestamp: number): string => {
  const date = new Date(timestamp);
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 60) return 'Just now';
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
  if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d ago`;

  return date.toLocaleDateString();
};

const DEFAULT_PROMPT = `For each input taxon name, determine its correct taxonomic rank and return it in the format:
Name (sp./gen./fam./ord./class./infraclass./phyl.).

IMPORTANT: The rank abbreviation MUST end with a period (e.g., "gen." not "gen").

Apply the following rules strictly:

If the name is a full binomial (Genus species), output (sp.).

If the name includes "sp." or "spp.", treat it as species-level and output (sp.).

If the name is a single Latin word in Genus form (capitalised), output (gen.).

If the name ends with "-idae", "-aceae", or other standard family endings, output (fam.).

If the name ends with "-formes", or otherwise matches a recognised order, output (ord.).

If the name matches a recognised infraclass, output (infraclass.).

If the name matches a recognised class, output (class.).

If the name matches a recognised phylum, output (phyl.).

CRITICAL: ALWAYS check spelling against WoRMS (World Register of Marine Species) database.

Correct any misspellings to the accepted valid name (e.g., "Trisopterus iuscus" → Trisopterus luscus).

If the input name is a synonym, update to the current accepted name.

Preserve only the accepted name + the correct rank abbreviation (with period) in brackets.

Return one taxon per line.

Output format example:
Sprattus sprattus (sp.)
Clupea (gen.)
Ammodytidae (fam.)
Pleuronectiformes (ord.)
Trisopterus luscus (sp.)
Teleostei (infraclass.)`;

export function AiPromptDialog({
  isOpen,
  onClose,
  selectedCellCount,
  onSubmit,
  isProcessing = false
}: AiPromptDialogProps) {
  const { toast } = useToast();
  const [prompt, setPrompt] = useState(DEFAULT_PROMPT);
  const [promptHistory, setPromptHistory] = useState<PromptHistoryEntry[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  // Load prompt history from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(PROMPT_HISTORY_KEY);
      if (stored) {
        const history = JSON.parse(stored) as PromptHistoryEntry[];
        setPromptHistory(history);
      }
    } catch (error) {
      console.error('Failed to load prompt history:', error);
    }
  }, []);

  // Save prompt to history
  const savePromptToHistory = (promptText: string) => {
    try {
      const trimmedPrompt = promptText.trim();
      if (!trimmedPrompt) return;

      setPromptHistory(prevHistory => {
        // Check if prompt already exists
        const existingIndex = prevHistory.findIndex(
          entry => entry.prompt.toLowerCase() === trimmedPrompt.toLowerCase()
        );

        let updatedHistory: PromptHistoryEntry[];

        if (existingIndex >= 0) {
          // Update existing entry's use count and timestamp
          updatedHistory = [...prevHistory];
          updatedHistory[existingIndex] = {
            ...updatedHistory[existingIndex],
            timestamp: Date.now(),
            useCount: updatedHistory[existingIndex].useCount + 1
          };
        } else {
          // Add new entry
          updatedHistory = [
            {
              prompt: trimmedPrompt,
              timestamp: Date.now(),
              useCount: 1
            },
            ...prevHistory
          ];
        }

        // Sort by most recently used and limit to MAX_HISTORY_ITEMS
        updatedHistory = updatedHistory
          .sort((a, b) => b.timestamp - a.timestamp)
          .slice(0, MAX_HISTORY_ITEMS);

        // Save to localStorage
        localStorage.setItem(PROMPT_HISTORY_KEY, JSON.stringify(updatedHistory));

        return updatedHistory;
      });
    } catch (error) {
      console.error('Failed to save prompt to history:', error);
    }
  };

  // Clear all history
  const clearHistory = () => {
    try {
      localStorage.removeItem(PROMPT_HISTORY_KEY);
      setPromptHistory([]);
      toast({
        title: 'History Cleared',
        description: 'All prompt history has been deleted'
      });
    } catch (error) {
      console.error('Failed to clear prompt history:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to clear prompt history'
      });
    }
  };

  // Delete single history entry
  const deleteHistoryEntry = (index: number) => {
    try {
      setPromptHistory(prevHistory => {
        const updatedHistory = prevHistory.filter((_, i) => i !== index);
        localStorage.setItem(PROMPT_HISTORY_KEY, JSON.stringify(updatedHistory));
        return updatedHistory;
      });
    } catch (error) {
      console.error('Failed to delete history entry:', error);
    }
  };

  // Reset to default prompt when dialog opens
  useEffect(() => {
    if (isOpen) {
      setPrompt(DEFAULT_PROMPT);
    }
  }, [isOpen]);

  const handleSubmit = async () => {
    if (!prompt.trim()) {
      toast({
        variant: 'destructive',
        title: 'Empty Prompt',
        description: 'Please enter a transformation prompt'
      });
      return;
    }

    // Save prompt to history before submitting
    savePromptToHistory(prompt);

    await onSubmit(prompt);
    // Keep the default prompt in the text box after submission
  };

  const handleClose = () => {
    if (!isProcessing) {
      // Reset to default prompt on close
      setPrompt(DEFAULT_PROMPT);
      onClose();
    }
  };

  const examplePrompts = [
    'For each input taxon name, determine its correct taxonomic rank and return it in the format Name (abbrev.). Use the following rules: If the name is a full binomial (Genus species), output (sp.). If the name includes \'sp.\' or \'spp.\', treat it as species-level and output (sp.). If the name is a single Latin word in Genus form (capitalised), output (gen.). If the name matches a known family (ends in -idae, -aceae, etc.), output (fam.). If the name matches an order (typically ends in -formes), output (ord.). If the name matches a class, output (class.). If the name matches a phylum, output (phyl.). IMPORTANT: Also check the spelling against recognized official taxonomic databases and correct any misspellings to the accepted scientific name. Return one taxon per line in the format: Name (sp./gen./fam./ord./class./phyl.). Also check the spelling of the taxon against the Worm database and update the spelling if needed.',
    'Convert dates to DD/MM/YYYY format',
    'Translate species names to Latin',
    'Add hyphens between words',
    'Convert to uppercase',
    'Remove leading/trailing spaces',
    'Extract first word only',
  ];

  // Helper to get first N words for preview
  const getPromptPreview = (prompt: string, wordCount: number = 6): string => {
    const words = prompt.split(' ');
    return words.length > wordCount
      ? words.slice(0, wordCount).join(' ') + '...'
      : prompt;
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-purple-500" />
            Transform {selectedCellCount} Cell{selectedCellCount !== 1 ? 's' : ''}
          </DialogTitle>
          <DialogDescription>
            Enter a prompt to transform the selected cells. The system will automatically select the best model based on your task.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Prompt Input */}
          <div className="space-y-2">
            <label htmlFor="ai-prompt" className="text-sm font-medium">
              Transformation Prompt
            </label>
            <Textarea
              id="ai-prompt"
              placeholder="Enter your transformation prompt..."
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={12}
              className="resize-none font-mono text-xs"
              disabled={isProcessing}
            />

            {/* Transform Button - Directly under text box */}
            <Button
              onClick={handleSubmit}
              disabled={isProcessing || !prompt.trim()}
              className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
              size="lg"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 mr-2" />
                  Transform
                </>
              )}
            </Button>
          </div>

          {/* Prompt History Section */}
          {promptHistory.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowHistory(!showHistory)}
                  className="text-sm font-medium text-muted-foreground hover:text-foreground p-0 h-auto"
                >
                  <History className="w-4 h-4 mr-1.5" />
                  Recent Prompts ({promptHistory.length})
                  <span className="ml-1 text-xs">
                    {showHistory ? '▼' : '▶'}
                  </span>
                </Button>
                {showHistory && promptHistory.length > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={clearHistory}
                    disabled={isProcessing}
                    className="text-xs text-destructive hover:text-destructive h-auto py-1"
                  >
                    <Trash2 className="w-3 h-3 mr-1" />
                    Clear All
                  </Button>
                )}
              </div>

              {showHistory && (
                <ScrollArea className="max-h-40 border rounded-md">
                  <div className="p-2 space-y-1">
                    {promptHistory.map((entry, idx) => (
                      <div
                        key={idx}
                        className="group flex items-start gap-2 p-2 rounded hover:bg-muted/50 transition-colors"
                      >
                        <Button
                          variant="ghost"
                          onClick={() => setPrompt(entry.prompt)}
                          disabled={isProcessing}
                          className="flex-1 justify-start text-left h-auto py-1 px-2 text-xs font-normal"
                          title={entry.prompt}
                        >
                          <Clock className="w-3 h-3 mr-2 shrink-0 text-muted-foreground" />
                          <div className="flex-1 min-w-0">
                            <div className="truncate">{entry.prompt}</div>
                            <div className="text-[10px] text-muted-foreground mt-0.5">
                              {formatTimestamp(entry.timestamp)}
                              {entry.useCount > 1 && (
                                <span className="ml-2">
                                  • Used {entry.useCount} time{entry.useCount > 1 ? 's' : ''}
                                </span>
                              )}
                            </div>
                          </div>
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteHistoryEntry(idx)}
                          disabled={isProcessing}
                          className="opacity-0 group-hover:opacity-100 transition-opacity h-6 w-6 p-0 shrink-0 mt-1"
                          title="Delete this prompt"
                        >
                          <Trash2 className="w-3 h-3 text-muted-foreground hover:text-destructive" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </div>
          )}

          {/* Cancel Button at Bottom */}
          <div className="flex justify-end pt-2">
            <Button
              variant="outline"
              onClick={handleClose}
              disabled={isProcessing}
            >
              Cancel
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
