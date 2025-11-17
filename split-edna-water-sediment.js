const fs = require('fs');
const path = require('path');

const inputFile = 'G:/.shortcut-targets-by-id/1QkmI63Nho2bLYjVC4vWXRdDRruEV5-Zl/Ocean/08 - Data/06 - eDNA/eDNA_META_2407/ALGA_EDNAW_ALL_2407_Hapl.csv';
const outputDir = 'G:/.shortcut-targets-by-id/1QkmI63Nho2bLYjVC4vWXRdDRruEV5-Zl/Ocean/08 - Data/06 - eDNA/eDNA_META_2407';

console.log('Reading input file...');
const content = fs.readFileSync(inputFile, 'utf-8');
const lines = content.split('\n');

console.log(`Total lines: ${lines.length}`);

// Parse header
const headerLine = lines[0];
const headers = [];
let inQuotes = false;
let currentField = '';

// Parse CSV header properly (handles commas in quotes)
for (let i = 0; i < headerLine.length; i++) {
  const char = headerLine[i];
  if (char === '"') {
    inQuotes = !inQuotes;
  } else if (char === ',' && !inQuotes) {
    headers.push(currentField.trim());
    currentField = '';
  } else {
    currentField += char;
  }
}
headers.push(currentField.trim()); // Push last field

console.log(`Total columns: ${headers.length}`);
console.log('First few headers:', headers.slice(0, 10));
console.log('Last few headers:', headers.slice(-10));

// Define water sample column names (Martin's Haven samples)
const waterSamples = [
  "Martin's Haven (Round 1) REP 1",
  "Martin's Haven (Round 1) REP 2",
  "Martin's Haven (Round 1) REP 3",
  "Martin's Haven (Round 2) REP 1",
  "Martin's Haven (Round 2) REP 2",
  "Martin's Haven (Round 2) REP 3"
];

// Define taxonomy columns (these should be kept in both files)
const taxonomyColumns = [
  'kingdom', 'phylum', 'class', 'order', 'family', 'genus', 'species',
  'common', 'RedList_Status', 'score'
];

// Find indices for water samples
const waterIndices = headers
  .map((h, i) => waterSamples.includes(h) ? i : -1)
  .filter(i => i !== -1);

console.log(`Water sample column indices: ${waterIndices.join(', ')}`);

// Find indices for sediment samples (all sample columns except water ones)
const sedimentIndices = [];
for (let i = 1; i < headers.length; i++) {
  const isWater = waterSamples.includes(headers[i]);
  const isTaxonomy = taxonomyColumns.includes(headers[i]);

  if (!isWater && !isTaxonomy && i !== 0) {
    // This is a sediment sample column
    sedimentIndices.push(i);
  }
}

console.log(`Sediment sample column indices: ${sedimentIndices.join(', ')}`);

// Find taxonomy column indices
const taxonomyIndices = headers
  .map((h, i) => taxonomyColumns.includes(h) ? i : -1)
  .filter(i => i !== -1);

console.log(`Taxonomy column indices: ${taxonomyIndices.join(', ')}`);

// Function to split a CSV line properly (handles commas in quotes)
function splitCsvLine(line) {
  const fields = [];
  let inQuotes = false;
  let currentField = '';

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
      currentField += char;
    } else if (char === ',' && !inQuotes) {
      fields.push(currentField);
      currentField = '';
    } else {
      currentField += char;
    }
  }
  fields.push(currentField);
  return fields;
}

// Create water file
console.log('\nCreating water samples file...');
const waterLines = [];

// Build water header
const waterHeader = [headers[0], ...waterIndices.map(i => headers[i]), ...taxonomyIndices.map(i => headers[i])];
waterLines.push(waterHeader.join(','));

// Process data lines
for (let i = 1; i < lines.length; i++) {
  if (lines[i].trim() === '') continue;

  const fields = splitCsvLine(lines[i]);
  if (fields.length < headers.length) continue;

  const waterRow = [fields[0], ...waterIndices.map(i => fields[i]), ...taxonomyIndices.map(i => fields[i])];
  waterLines.push(waterRow.join(','));
}

const waterOutputFile = path.join(outputDir, 'META_EDNAW_2407_Hapl.csv');
fs.writeFileSync(waterOutputFile, waterLines.join('\n'), 'utf-8');
console.log(`Water file created: ${waterOutputFile}`);
console.log(`Water file lines: ${waterLines.length}`);

// Create sediment file
console.log('\nCreating sediment samples file...');
const sedimentLines = [];

// Build sediment header
const sedimentHeader = [headers[0], ...sedimentIndices.map(i => headers[i]), ...taxonomyIndices.map(i => headers[i])];
sedimentLines.push(sedimentHeader.join(','));

// Process data lines
for (let i = 1; i < lines.length; i++) {
  if (lines[i].trim() === '') continue;

  const fields = splitCsvLine(lines[i]);
  if (fields.length < headers.length) continue;

  const sedimentRow = [fields[0], ...sedimentIndices.map(i => fields[i]), ...taxonomyIndices.map(i => fields[i])];
  sedimentLines.push(sedimentRow.join(','));
}

const sedimentOutputFile = path.join(outputDir, 'META_EDNAS_2407_Hapl.csv');
fs.writeFileSync(sedimentOutputFile, sedimentLines.join('\n'), 'utf-8');
console.log(`Sediment file created: ${sedimentOutputFile}`);
console.log(`Sediment file lines: ${sedimentLines.length}`);

console.log('\n✓ Split complete!');
console.log(`\nWater samples (${waterIndices.length} columns): ${waterSamples.join(', ')}`);
console.log(`\nSediment samples (${sedimentIndices.length} columns): ${sedimentIndices.map(i => headers[i]).join(', ')}`);
