import OpenAI from 'openai';
import { logger } from './logger';

// Lazy-initialize OpenAI client only when needed (server-side only)
let openai: OpenAI | null = null;

function getOpenAIClient(): OpenAI {
  if (!openai) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY environment variable is not set. AI validation will not work.');
    }
    openai = new OpenAI({ apiKey });
  }
  return openai;
}

// Types
export interface SpeciesMatch {
  standardizedName: string; // The "official" most complete name
  variants: string[]; // All variations found (e.g., ["Phocoena phocoena", "P. phocoena"])
  filesWithMatch: string[]; // Which files contain this species
}

export interface SpeciesCorrection {
  original: string;
  corrected: string;
  reason: string; // "spelling correction", "standardized abbreviation", etc.
  fileName: string;
  confidence: 'high' | 'medium' | 'low';
}

export interface SpeciesValidationResult {
  matches: SpeciesMatch[];
  corrections: SpeciesCorrection[];
  uniqueSpecies: string[]; // Deduplicated and corrected list (sorted A-Z)
  needsAiValidation: boolean; // True if mismatches detected
  aiValidationPerformed: boolean;
}

interface FileSpeciesList {
  fileName: string;
  species: string[];
}

/**
 * Normalizes a species name for comparison (lowercase, trimmed, single spaces)
 */
function normalizeSpeciesName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * Checks if two species names are likely the same species but with different formatting
 * Examples of matches:
 * - "Phocoena phocoena" vs "P. phocoena" (abbreviated genus)
 * - "Delphinus delphis" vs "delphinus delphis" (case difference)
 * - "Tursiops truncatus" vs " Tursiops truncatus " (whitespace)
 */
function areLikelyMatch(name1: string, name2: string): boolean {
  const norm1 = normalizeSpeciesName(name1);
  const norm2 = normalizeSpeciesName(name2);

  // Exact match after normalization
  if (norm1 === norm2) return true;

  // Check if one is an abbreviated version of the other
  // e.g., "p. phocoena" matches "phocoena phocoena"
  const parts1 = norm1.split(' ');
  const parts2 = norm2.split(' ');

  // Both must have at least 2 words (genus + species)
  if (parts1.length < 2 || parts2.length < 2) return false;

  // Check if genus is abbreviated in one
  const genus1Abbreviated = parts1[0].length === 2 && parts1[0].endsWith('.');
  const genus2Abbreviated = parts2[0].length === 2 && parts2[0].endsWith('.');

  if (genus1Abbreviated && !genus2Abbreviated) {
    // name1 is abbreviated, check if it matches name2
    const genus1Letter = parts1[0][0];
    const genus2FirstLetter = parts2[0][0];
    return genus1Letter === genus2FirstLetter && parts1[1] === parts2[1];
  }

  if (genus2Abbreviated && !genus1Abbreviated) {
    // name2 is abbreviated, check if it matches name1
    const genus2Letter = parts2[0][0];
    const genus1FirstLetter = parts1[0][0];
    return genus2Letter === genus1FirstLetter && parts2[1] === parts1[1];
  }

  return false;
}

/**
 * Selects the most complete name from a list of variants
 * Preference: Full genus name > Abbreviated genus name
 */
function selectMostCompleteName(variants: string[]): string {
  // Sort by length descending, then alphabetically
  const sorted = [...variants].sort((a, b) => {
    // Prefer non-abbreviated names
    const aAbbreviated = /^[A-Z]\.\s/.test(a.trim());
    const bAbbreviated = /^[A-Z]\.\s/.test(b.trim());

    if (aAbbreviated && !bAbbreviated) return 1;
    if (!aAbbreviated && bAbbreviated) return -1;

    // Then by length (longer is more complete)
    if (a.length !== b.length) return b.length - a.length;

    // Finally alphabetically
    return a.localeCompare(b);
  });

  return sorted[0];
}

/**
 * Performs non-AI species matching across files
 * Uses exact matching and pattern-based heuristics to group species
 */
function performNonAiMatching(
  speciesLists: FileSpeciesList[]
): {
  matches: SpeciesMatch[];
  possibleMismatches: string[];
} {
  const matches: SpeciesMatch[] = [];
  const processedSpecies = new Set<string>();
  const possibleMismatches: string[] = [];

  // Build a flat list of all species with their source files
  const allSpeciesEntries: Array<{ species: string; fileName: string }> = [];
  for (const fileList of speciesLists) {
    for (const species of fileList.species) {
      allSpeciesEntries.push({ species, fileName: fileList.fileName });
    }
  }

  // Group species by potential matches
  for (const entry of allSpeciesEntries) {
    if (processedSpecies.has(normalizeSpeciesName(entry.species))) {
      continue;
    }

    // Find all matching entries
    const matchingEntries = allSpeciesEntries.filter(e =>
      areLikelyMatch(entry.species, e.species)
    );

    if (matchingEntries.length === 0) continue;

    // Mark all as processed
    matchingEntries.forEach(e =>
      processedSpecies.add(normalizeSpeciesName(e.species))
    );

    // Get unique variants and files
    const variants = [...new Set(matchingEntries.map(e => e.species))];
    const filesWithMatch = [...new Set(matchingEntries.map(e => e.fileName))];

    // Check if there are multiple variants (potential mismatch)
    if (variants.length > 1) {
      possibleMismatches.push(...variants);
    }

    matches.push({
      standardizedName: selectMostCompleteName(variants),
      variants,
      filesWithMatch,
    });
  }

  return { matches, possibleMismatches };
}

/**
 * Uses AI to validate and correct species names
 * Only called when mismatches are detected
 */
async function performAiValidation(
  speciesList: string[]
): Promise<SpeciesCorrection[]> {
  const corrections: SpeciesCorrection[] = [];

  // Batch species into groups of 10 for efficiency
  const batchSize = 10;
  const batches: string[][] = [];

  for (let i = 0; i < speciesList.length; i += batchSize) {
    batches.push(speciesList.slice(i, i + batchSize));
  }

  logger.info(`Validating ${speciesList.length} species names in ${batches.length} batches`, {
    context: 'species-validation',
  });

  for (const batch of batches) {
    try {
      const systemPrompt = `You are a marine biology taxonomist assistant. Your task is to validate and standardize species names from eDNA sampling data.

For each species name provided, you should:
1. Verify if it's a valid marine species name
2. Correct any spelling mistakes
3. Expand abbreviated genus names (e.g., "P. phocoena" → "Phocoena phocoena")
4. Standardize formatting (proper capitalization, spacing)
5. Return the corrected name, or the original if no correction is needed

Return your response as a JSON array with this structure:
[
  {
    "original": "original name",
    "corrected": "corrected name",
    "reason": "spelling correction" | "expanded abbreviation" | "no correction needed",
    "confidence": "high" | "medium" | "low"
  }
]

Important:
- Only correct actual errors, don't change valid alternative names
- If multiple species share the same genus, you can identify the pattern
- Confidence is "high" for obvious corrections, "medium" for likely corrections, "low" for uncertain`;

      const userPrompt = `Validate and correct these marine species names:\n\n${batch.map((s, i) => `${i + 1}. ${s}`).join('\n')}`;

      const client = getOpenAIClient();
      const response = await client.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        response_format: { type: 'json_object' },
        temperature: 0.2, // Low temperature for consistent corrections
        max_tokens: 2000,
      });

      const result = response.choices[0]?.message?.content;
      if (result) {
        const parsed = JSON.parse(result);
        const results = Array.isArray(parsed) ? parsed : parsed.results || [];

        for (const item of results) {
          if (item.original !== item.corrected) {
            corrections.push({
              original: item.original,
              corrected: item.corrected,
              reason: item.reason,
              fileName: '', // Will be filled in by caller
              confidence: item.confidence,
            });
          }
        }
      }

      logger.info(`Validated batch of ${batch.length} species`, {
        context: 'species-validation',
        data: { correctionsFound: corrections.length }
      });

    } catch (error) {
      logger.error('AI validation failed for batch', error as Error, {
        context: 'species-validation',
        data: { batchSize: batch.length }
      });
      // Continue with next batch on error
    }
  }

  return corrections;
}

/**
 * Main function to match species across files
 * Uses hybrid approach: non-AI first, then AI if mismatches detected
 */
export async function matchSpeciesAcrossFiles(
  speciesLists: FileSpeciesList[],
  forceAiValidation: boolean = false
): Promise<SpeciesValidationResult> {
  logger.info('Starting species matching across files', {
    context: 'species-validation',
    data: {
      fileCount: speciesLists.length,
      totalSpecies: speciesLists.reduce((sum, f) => sum + f.species.length, 0)
    }
  });

  // Step 1: Non-AI matching
  const { matches, possibleMismatches } = performNonAiMatching(speciesLists);

  logger.info('Non-AI matching complete', {
    context: 'species-validation',
    data: {
      matchesFound: matches.length,
      possibleMismatches: possibleMismatches.length
    }
  });

  // Step 2: Determine if AI validation is needed
  const needsAiValidation = forceAiValidation || possibleMismatches.length > 0;
  let corrections: SpeciesCorrection[] = [];
  let aiValidationPerformed = false;

  if (needsAiValidation) {
    logger.info('AI validation triggered', {
      context: 'species-validation',
      data: { reason: forceAiValidation ? 'forced' : 'mismatches detected' }
    });

    // Only validate the species that have potential issues
    const speciesToValidate = forceAiValidation
      ? [...new Set(speciesLists.flatMap(f => f.species))]
      : [...new Set(possibleMismatches)];

    corrections = await performAiValidation(speciesToValidate);
    aiValidationPerformed = true;

    // Apply corrections to matches
    if (corrections.length > 0) {
      // Map original names to corrected names
      const correctionMap = new Map(
        corrections.map(c => [normalizeSpeciesName(c.original), c.corrected])
      );

      // Update matches with corrected names
      for (const match of matches) {
        const correctedVariants = match.variants.map(v => {
          const normalized = normalizeSpeciesName(v);
          return correctionMap.get(normalized) || v;
        });

        match.standardizedName = selectMostCompleteName(correctedVariants);
        match.variants = correctedVariants;
      }
    }
  }

  // Step 3: Build unique species list (sorted alphabetically)
  const uniqueSpecies = matches
    .map(m => m.standardizedName)
    .sort((a, b) => a.localeCompare(b));

  logger.info('Species matching complete', {
    context: 'species-validation',
    data: {
      uniqueSpecies: uniqueSpecies.length,
      corrections: corrections.length,
      aiValidationPerformed
    }
  });

  return {
    matches,
    corrections,
    uniqueSpecies,
    needsAiValidation,
    aiValidationPerformed,
  };
}

/**
 * Helper function to map corrections to specific files
 */
export function mapCorrectionsToFiles(
  corrections: SpeciesCorrection[],
  speciesLists: FileSpeciesList[]
): SpeciesCorrection[] {
  const mappedCorrections: SpeciesCorrection[] = [];

  for (const correction of corrections) {
    for (const fileList of speciesLists) {
      if (fileList.species.some(s => normalizeSpeciesName(s) === normalizeSpeciesName(correction.original))) {
        mappedCorrections.push({
          ...correction,
          fileName: fileList.fileName,
        });
      }
    }
  }

  return mappedCorrections;
}
