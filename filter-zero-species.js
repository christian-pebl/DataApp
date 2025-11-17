const fs = require('fs');
const path = require('path');

const baseDir = 'G:/.shortcut-targets-by-id/1QkmI63Nho2bLYjVC4vWXRdDRruEV5-Zl/Ocean/08 - Data/06 - eDNA/eDNA_META_2407';

const files = [
  {
    input: path.join(baseDir, 'META_EDNAW_2407_Hapl.csv'),
    output: path.join(baseDir, 'META_EDNAW_2407_Hapl2.csv'),
    name: 'Water'
  },
  {
    input: path.join(baseDir, 'META_EDNAS_2407_Hapl.csv'),
    output: path.join(baseDir, 'META_EDNAS_2407_Hapl2.csv'),
    name: 'Sediment'
  }
];

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

// Process each file
files.forEach(fileInfo => {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Processing ${fileInfo.name} samples file...`);
  console.log(`Input: ${fileInfo.input}`);

  const content = fs.readFileSync(fileInfo.input, 'utf-8');
  const lines = content.split('\n').filter(line => line.trim() !== '');

  console.log(`Total lines (including header): ${lines.length}`);

  // Parse header
  const headerLine = lines[0];
  const headers = splitCsvLine(headerLine);

  console.log(`Total columns: ${headers.length}`);

  // Taxonomy columns are at the end
  const taxonomyColumns = ['kingdom', 'phylum', 'class', 'order', 'family', 'genus', 'species', 'common', 'RedList_Status', 'score'];

  // Find where taxonomy columns start
  const taxonomyStartIndex = headers.findIndex(h => h === 'kingdom');
  console.log(`Taxonomy starts at column index: ${taxonomyStartIndex}`);

  // Sample columns are between column 1 and taxonomyStartIndex
  const sampleStartIndex = 1; // Skip first column (species name)
  const sampleEndIndex = taxonomyStartIndex;
  const sampleColumnCount = sampleEndIndex - sampleStartIndex;

  console.log(`Sample columns: indices ${sampleStartIndex} to ${sampleEndIndex - 1} (${sampleColumnCount} columns)`);

  // Filter rows
  const filteredLines = [headerLine]; // Keep header
  let removedCount = 0;
  let keptCount = 0;

  for (let i = 1; i < lines.length; i++) {
    const fields = splitCsvLine(lines[i]);

    if (fields.length < headers.length) {
      console.log(`Warning: Line ${i + 1} has ${fields.length} fields, expected ${headers.length}`);
      continue;
    }

    // Check if all sample columns are zero
    let hasNonZero = false;
    for (let j = sampleStartIndex; j < sampleEndIndex; j++) {
      const value = parseFloat(fields[j]);
      if (!isNaN(value) && value !== 0) {
        hasNonZero = true;
        break;
      }
    }

    if (hasNonZero) {
      filteredLines.push(lines[i]);
      keptCount++;
    } else {
      removedCount++;
      // Optionally log first few removed species
      if (removedCount <= 5) {
        console.log(`  Removed (all zeros): ${fields[0]}`);
      }
    }
  }

  if (removedCount > 5) {
    console.log(`  ... and ${removedCount - 5} more species with all zeros`);
  }

  console.log(`\nResults:`);
  console.log(`  Species kept: ${keptCount}`);
  console.log(`  Species removed: ${removedCount}`);
  console.log(`  Total output lines: ${filteredLines.length} (including header)`);

  // Write output file
  fs.writeFileSync(fileInfo.output, filteredLines.join('\n'), 'utf-8');
  console.log(`\n✓ Output written to: ${fileInfo.output}`);
});

console.log(`\n${'='.repeat(60)}`);
console.log('✓ All files processed successfully!');
