const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

const excelFilePath = process.argv[2];

if (!excelFilePath) {
  console.error('Usage: node split-excel-to-csv.js <path-to-excel-file>');
  process.exit(1);
}

if (!fs.existsSync(excelFilePath)) {
  console.error(`Error: File not found: ${excelFilePath}`);
  process.exit(1);
}

console.log(`Reading Excel file: ${excelFilePath}`);

const workbook = XLSX.readFile(excelFilePath);

const dir = path.dirname(excelFilePath);
const baseName = path.basename(excelFilePath, path.extname(excelFilePath));

console.log(`Found ${workbook.SheetNames.length} sheets:`);
workbook.SheetNames.forEach(sheetName => console.log(`  - ${sheetName}`));

workbook.SheetNames.forEach((sheetName) => {
  const worksheet = workbook.Sheets[sheetName];

  const sanitizedSheetName = sheetName.replace(/[<>:"/\\|?*]/g, '_');
  const csvFileName = `${baseName}_${sanitizedSheetName}.csv`;
  const csvFilePath = path.join(dir, csvFileName);

  const csvContent = XLSX.utils.sheet_to_csv(worksheet);

  fs.writeFileSync(csvFilePath, csvContent, 'utf8');

  console.log(`Created: ${csvFileName}`);
});

console.log('\nDone! All sheets have been exported to CSV files.');
