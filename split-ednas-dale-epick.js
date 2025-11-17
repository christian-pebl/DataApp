const fs = require('fs');
const path = require('path');

const baseDir = 'G:/.shortcut-targets-by-id/1QkmI63Nho2bLYjVC4vWXRdDRruEV5-Zl/Ocean/08 - Data/06 - eDNA/eDNA_META_2407';
const inputFile = path.join(baseDir, 'META_EDNAS_2407_Hapl2.csv');

console.log('Reading sediment samples file...');
const content = fs.readFileSync(inputFile, 'utf-8');
const lines = content.split('\n').filter(line => line.trim() !== '');

console.log(`Total lines: ${lines.length}`);

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

// Parse header
const headerLine = lines[0];
const headers = splitCsvLine(headerLine);

console.log(`Total columns: ${headers.length}`);
console.log('\nAll sample columns:');
headers.forEach((h, i) => {
  if (i > 0 && i < headers.length && !['kingdom', 'phylum', 'class', 'order', 'family', 'genus', 'species', 'common', 'RedList_Status', 'score'].includes(h)) {
    console.log(`  ${i}: ${h}`);
  }
});

// Identify Dale and EPICK sample columns
const daleIndices = [];
const epickIndices = [];
const taxonomyColumns = ['kingdom', 'phylum', 'class', 'order', 'family', 'genus', 'species', 'common', 'RedList_Status', 'score'];

for (let i = 1; i < headers.length; i++) {
  const header = headers[i];

  if (taxonomyColumns.includes(header)) {
    continue; // Skip taxonomy columns
  }

  // Check if this is a Dale column
  if (header.startsWith('Dale 1') || header.startsWith('Dale 2')) {
    daleIndices.push(i);
  } else if (i !== 0) { // Not the species name column
    epickIndices.push(i);
  }
}

console.log(`\nDale sample columns (${daleIndices.length}):`);
daleIndices.forEach(i => console.log(`  ${i}: ${headers[i]}`));

console.log(`\nEPICK sample columns (${epickIndices.length}):`);
epickIndices.forEach(i => console.log(`  ${i}: ${headers[i]}`));

// Find taxonomy column indices
const taxonomyIndices = headers
  .map((h, i) => taxonomyColumns.includes(h) ? i : -1)
  .filter(i => i !== -1);

console.log(`\nTaxonomy column indices: ${taxonomyIndices.join(', ')}`);

// Create Dale file
console.log('\n' + '='.repeat(60));
console.log('Creating Dale samples file...');
const daleLines = [];

// Build Dale header
const daleHeader = [headers[0], ...daleIndices.map(i => headers[i]), ...taxonomyIndices.map(i => headers[i])];
daleLines.push(daleHeader.join(','));

// Process data lines
for (let i = 1; i < lines.length; i++) {
  const fields = splitCsvLine(lines[i]);
  if (fields.length < headers.length) continue;

  const daleRow = [fields[0], ...daleIndices.map(i => fields[i]), ...taxonomyIndices.map(i => fields[i])];
  daleLines.push(daleRow.join(','));
}

const daleOutputFile = path.join(baseDir, 'META_EDNAS_DALE_2407_Hapl2.csv');
fs.writeFileSync(daleOutputFile, daleLines.join('\n'), 'utf-8');
console.log(`Dale file created: ${daleOutputFile}`);
console.log(`Dale file lines: ${daleLines.length}`);

// Create EPICK file
console.log('\n' + '='.repeat(60));
console.log('Creating EPICK samples file...');
const epickLines = [];

// Build EPICK header
const epickHeader = [headers[0], ...epickIndices.map(i => headers[i]), ...taxonomyIndices.map(i => headers[i])];
epickLines.push(epickHeader.join(','));

// Process data lines
for (let i = 1; i < lines.length; i++) {
  const fields = splitCsvLine(lines[i]);
  if (fields.length < headers.length) continue;

  const epickRow = [fields[0], ...epickIndices.map(i => fields[i]), ...taxonomyIndices.map(i => fields[i])];
  epickLines.push(epickRow.join(','));
}

const epickOutputFile = path.join(baseDir, 'META_EDNAS_EPICK_2407_Hapl2.csv');
fs.writeFileSync(epickOutputFile, epickLines.join('\n'), 'utf-8');
console.log(`EPICK file created: ${epickOutputFile}`);
console.log(`EPICK file lines: ${epickLines.length}`);

console.log('\n' + '='.repeat(60));
console.log('✓ Split complete!');
console.log(`\nDale samples (${daleIndices.length} columns): ${daleIndices.map(i => headers[i]).join(', ')}`);
console.log(`\nEPICK samples (${epickIndices.length} columns): ${epickIndices.map(i => headers[i]).join(', ')}`);
