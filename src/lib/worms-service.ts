import { logger } from './logger';

/**
 * WoRMS (World Register of Marine Species) API Integration
 *
 * Provides fast, authoritative lookups for marine species taxonomy
 * API Documentation: https://www.marinespecies.org/rest/
 */

export interface WormsRecord {
  AphiaID: number;
  scientificname: string;
  authority: string;
  status: string;           // 'accepted', 'unaccepted', 'uncertain'
  unacceptreason?: string;
  rank: string;             // 'Species', 'Genus', 'Family', 'Order', 'Class', 'Phylum'
  valid_AphiaID: number;
  valid_name: string;
  valid_authority: string;
  kingdom: string;
  phylum: string;
  class: string;
  order: string;
  family: string;
  genus: string;
  citation: string;
  lsid: string;
  isMarine: number;
  isBrackish: number;
  isFreshwater: number;
  isTerrestrial: number;
  isExtinct: number | null;
  match_type: string;       // 'exact', 'phonetic', 'near_1', etc.
  modified: string;
}

export interface WormsLookupResult {
  found: boolean;
  formattedName: string;
  originalName: string;
  source: 'worms' | 'llm' | 'cache';
  record?: WormsRecord;
  confidence: 'high' | 'medium' | 'low';
  processingTime: number;
}

/**
 * Maps WoRMS rank names to standardized abbreviations
 */
export function getRankAbbreviation(rank: string): string {
  const rankMap: Record<string, string> = {
    'Species': 'sp.',
    'Genus': 'gen.',
    'Subgenus': 'gen.',
    'Family': 'fam.',
    'Subfamily': 'fam.',
    'Order': 'ord.',
    'Suborder': 'ord.',
    'Class': 'class.',
    'Subclass': 'class.',
    'Phylum': 'phyl.',
    'Subphylum': 'phyl.',
    'Kingdom': 'kingdom',
    'Superclass': 'class.',
    'Superfamily': 'fam.',
    'Tribe': 'fam.',
    'Subtribe': 'fam.'
  };

  return rankMap[rank] || rank.toLowerCase() + '.';
}

/**
 * Cleans and normalizes taxon names for better matching
 */
export function cleanTaxonName(name: string): string {
  return name
    .trim()
    .replace(/\s+/g, ' ')                    // Normalize whitespace
    .replace(/\(.*?\)/g, '')                 // Remove rank abbreviations in parentheses
    .replace(/\s+(sp\.|spp\.|gen\.|fam\.)$/i, '')  // Remove trailing rank abbreviations
    .trim();
}

/**
 * Looks up a taxon name in the WoRMS database
 *
 * @param name - The scientific name to look up
 * @param fuzzyMatch - Whether to allow fuzzy matching (default: true)
 * @returns WormsRecord or null if not found
 */
export async function lookupWormsRecord(
  name: string,
  fuzzyMatch: boolean = true
): Promise<WormsRecord | null> {
  try {
    const cleanedName = cleanTaxonName(name);

    if (!cleanedName) {
      logger.warn('Empty taxon name after cleaning', {
        context: 'worms-service',
        data: { originalName: name }
      });
      return null;
    }

    // WoRMS API endpoint - use fuzzy matching by default
    const likeParam = fuzzyMatch ? 'true' : 'false';
    const url = `https://www.marinespecies.org/rest/AphiaRecordsByName/${encodeURIComponent(cleanedName)}?like=${likeParam}&marine_only=false`;

    logger.info('WoRMS API lookup started', {
      context: 'worms-service',
      data: { originalName: name, cleanedName, fuzzyMatch, url }
    });

    const startTime = Date.now();
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json'
      },
      // Cache for 24 hours to reduce API load
      next: { revalidate: 86400 }
    });

    const duration = Date.now() - startTime;

    if (!response.ok) {
      if (response.status === 204) {
        // 204 = No content (name not found)
        logger.info('WoRMS lookup: No records found', {
          context: 'worms-service',
          data: { name: cleanedName, duration }
        });
        return null;
      }

      logger.warn('WoRMS API error', {
        context: 'worms-service',
        data: { status: response.status, statusText: response.statusText, name: cleanedName }
      });
      return null;
    }

    const records: WormsRecord[] = await response.json();

    if (!records || records.length === 0) {
      logger.info('WoRMS lookup: Empty result set', {
        context: 'worms-service',
        data: { name: cleanedName, duration }
      });
      return null;
    }

    // Prefer accepted names over unaccepted
    const acceptedRecord = records.find(r => r.status === 'accepted');
    const bestRecord = acceptedRecord || records[0];

    logger.info('WoRMS lookup successful', {
      context: 'worms-service',
      data: {
        originalName: name,
        cleanedName,
        foundName: bestRecord.scientificname,
        rank: bestRecord.rank,
        status: bestRecord.status,
        matchType: bestRecord.match_type,
        recordsFound: records.length,
        duration,
        wasAccepted: !!acceptedRecord
      }
    });

    return bestRecord;
  } catch (error) {
    logger.error('WoRMS lookup failed', error as Error, {
      context: 'worms-service',
      data: { name }
    });
    return null;
  }
}

/**
 * Formats a WoRMS record into standardized taxonomic notation
 * Format: "Scientific Name (rank.)"
 *
 * @param record - The WoRMS record
 * @returns Formatted string
 */
export function formatWormsRecord(record: WormsRecord): string {
  // Use valid_name for unaccepted records, scientificname for accepted
  const name = record.status === 'accepted' ? record.scientificname : record.valid_name;
  const rank = getRankAbbreviation(record.rank);

  return `${name} (${rank})`;
}

/**
 * Comprehensive taxon classification function that tries WoRMS first,
 * then falls back to LLM if needed
 *
 * @param name - The taxon name to classify
 * @param useLlmFallback - Whether to use LLM if WoRMS lookup fails (default: false)
 * @returns WormsLookupResult with formatted name and metadata
 */
export async function classifyTaxon(
  name: string,
  useLlmFallback: boolean = false
): Promise<WormsLookupResult> {
  const startTime = Date.now();

  // Try WoRMS lookup first
  const wormsRecord = await lookupWormsRecord(name, true);

  if (wormsRecord) {
    const formattedName = formatWormsRecord(wormsRecord);
    const processingTime = Date.now() - startTime;

    // Determine confidence based on match type and status
    let confidence: 'high' | 'medium' | 'low' = 'medium';
    if (wormsRecord.match_type === 'exact' && wormsRecord.status === 'accepted') {
      confidence = 'high';
    } else if (wormsRecord.match_type === 'exact' || wormsRecord.status === 'accepted') {
      confidence = 'medium';
    } else {
      confidence = 'low';
    }

    logger.info('Taxon classified via WoRMS', {
      context: 'worms-service',
      data: {
        originalName: name,
        formattedName,
        confidence,
        processingTime
      }
    });

    return {
      found: true,
      formattedName,
      originalName: name,
      source: 'worms',
      record: wormsRecord,
      confidence,
      processingTime
    };
  }

  // WoRMS lookup failed - return unmodified name
  // (LLM fallback will be handled at a higher level if needed)
  const processingTime = Date.now() - startTime;

  logger.info('Taxon not found in WoRMS', {
    context: 'worms-service',
    data: {
      originalName: name,
      processingTime,
      useLlmFallback
    }
  });

  return {
    found: false,
    formattedName: name, // Return original name unmodified
    originalName: name,
    source: 'worms',
    confidence: 'low',
    processingTime
  };
}

/**
 * Batch lookup for multiple taxon names
 * Processes in parallel for better performance
 *
 * @param names - Array of taxon names
 * @param maxConcurrent - Maximum concurrent requests (default: 5)
 * @returns Array of WormsLookupResult
 */
export async function classifyTaxonBatch(
  names: string[],
  maxConcurrent: number = 5
): Promise<WormsLookupResult[]> {
  const results: WormsLookupResult[] = [];

  // Process in batches to avoid overwhelming the API
  for (let i = 0; i < names.length; i += maxConcurrent) {
    const batch = names.slice(i, i + maxConcurrent);

    const batchPromises = batch.map(name => classifyTaxon(name, false));
    const batchResults = await Promise.allSettled(batchPromises);

    batchResults.forEach((result, idx) => {
      if (result.status === 'fulfilled') {
        results.push(result.value);
      } else {
        // Handle failed lookup
        const name = batch[idx];
        logger.error('Batch taxon classification failed', result.reason, {
          context: 'worms-service',
          data: { name, batchIndex: i + idx }
        });

        results.push({
          found: false,
          formattedName: name,
          originalName: name,
          source: 'worms',
          confidence: 'low',
          processingTime: 0
        });
      }
    });
  }

  logger.info('Batch taxon classification complete', {
    context: 'worms-service',
    data: {
      totalNames: names.length,
      foundCount: results.filter(r => r.found).length,
      notFoundCount: results.filter(r => !r.found).length
    }
  });

  return results;
}
