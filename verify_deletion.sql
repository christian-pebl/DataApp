SELECT file_name, project_id, pin_id
FROM pin_files
WHERE file_name LIKE '%_nmax%'
ORDER BY project_id, file_name;
