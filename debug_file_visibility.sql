SELECT
  'Files attached to pins' as category,
  COUNT(*) as file_count,
  string_agg(DISTINCT file_name, ', ' ORDER BY file_name) as file_names
FROM pin_files
WHERE pin_id IS NOT NULL
  AND file_name LIKE '%ALGA_SUBCAM%nmax%'

UNION ALL

SELECT
  'Files attached to areas' as category,
  COUNT(*) as file_count,
  string_agg(DISTINCT file_name, ', ' ORDER BY file_name) as file_names
FROM pin_files
WHERE area_id IS NOT NULL
  AND file_name LIKE '%ALGA_SUBCAM%nmax%'

UNION ALL

SELECT
  'Files with neither pin_id nor area_id (orphaned)' as category,
  COUNT(*) as file_count,
  string_agg(DISTINCT file_name, ', ' ORDER BY file_name) as file_names
FROM pin_files
WHERE pin_id IS NULL
  AND area_id IS NULL
  AND file_name LIKE '%ALGA_SUBCAM%nmax%';
