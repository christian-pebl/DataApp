DELETE FROM pin_files
WHERE file_name IN (
  'ALGA_SUBCAM_C_S_2406_2407_nmax.csv',
  'ALGA_SUBCAM_C_S_2408_2409_nmax.csv',
  'ALGA_SUBCAM_C_S_2410_2501_nmax.csv',
  'ALGA_SUBCAM_C_S_2504_2506_nmax.csv',
  'ALGA_SUBCAM_F_AS_2410_2501_nmax.csv',
  'ALGA_SUBCAM_F_AS_2503_2504_nmax.csv',
  'ALGA_SUBCAM_F_AS_2504_2506_nmax.csv',
  'ALGA_SUBCAM_F_L_2503_2504_nmax.csv',
  'Subcam_Alga_Control_S_2408-2409_nmax.csv'
)
AND project_id = 'blakeneyoverfalls';
