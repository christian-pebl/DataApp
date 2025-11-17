SELECT
  id,
  file_name,
  pin_id,
  area_id,
  project_id,
  uploaded_at,
  start_date,
  end_date
FROM pin_files
WHERE file_name LIKE '%_nmax%'
ORDER BY file_name;
