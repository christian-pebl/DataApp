CREATE TABLE IF NOT EXISTS public.species_taxonomy (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  species_name TEXT NOT NULL UNIQUE,
  taxonomy_source TEXT NOT NULL,
  taxon_id TEXT NOT NULL,
  common_names TEXT[],
  hierarchy JSONB,
  confidence TEXT NOT NULL,
  rank TEXT NOT NULL,
  match_type TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_species_taxonomy_species_name ON public.species_taxonomy(species_name);
CREATE INDEX IF NOT EXISTS idx_species_taxonomy_taxonomy_source ON public.species_taxonomy(taxonomy_source);
CREATE INDEX IF NOT EXISTS idx_species_taxonomy_confidence ON public.species_taxonomy(confidence);

ALTER TABLE public.species_taxonomy ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow read access to all authenticated users"
  ON public.species_taxonomy
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow insert for authenticated users"
  ON public.species_taxonomy
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Allow update for authenticated users"
  ON public.species_taxonomy
  FOR UPDATE
  TO authenticated
  USING (true);

COMMENT ON TABLE public.species_taxonomy IS 'Stores taxonomy information fetched from WoRMS and GBIF APIs for species. Acts as a permanent cache to avoid repeated API calls.';
COMMENT ON COLUMN public.species_taxonomy.species_name IS 'Scientific name of the species (normalized to lowercase)';
COMMENT ON COLUMN public.species_taxonomy.taxonomy_source IS 'Source of taxonomy data: worms, gbif, or unknown';
COMMENT ON COLUMN public.species_taxonomy.taxon_id IS 'AphiaID (WoRMS) or usageKey (GBIF)';
COMMENT ON COLUMN public.species_taxonomy.common_names IS 'Array of common/vernacular names';
COMMENT ON COLUMN public.species_taxonomy.hierarchy IS 'Full taxonomic hierarchy: kingdom, phylum, class, order, family, genus, species';
COMMENT ON COLUMN public.species_taxonomy.confidence IS 'Match confidence: high, medium, or low';
COMMENT ON COLUMN public.species_taxonomy.rank IS 'Taxonomic rank abbreviation: sp., gen., fam., ord., class., phyl.';
COMMENT ON COLUMN public.species_taxonomy.match_type IS 'Type of match: exact or fuzzy';
