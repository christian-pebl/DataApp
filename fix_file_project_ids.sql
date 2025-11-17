UPDATE pin_files
SET project_id = pins.project_id
FROM pins
WHERE pin_files.pin_id = pins.id;

UPDATE pin_files
SET project_id = areas.project_id
FROM areas
WHERE pin_files.area_id = areas.id;
