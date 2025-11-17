const fs = require('fs');
const path = require('path');

const baseDir = 'G:/.shortcut-targets-by-id/1QkmI63Nho2bLYjVC4vWXRdDRruEV5-Zl/Ocean/08 - Data/06 - eDNA/eDNA_META_2407';

// Files to process
const files = [
  {
    input: 'META_EDNAW_2407_Hapl2.csv',
    output: 'META_EDNAW_2407_Hapl3.csv',
    name: 'Water'
  },
  {
    input: 'META_EDNAS_2407_Hapl2.csv',
    output: 'META_EDNAS_2407_Hapl3.csv',
    name: 'All Sediment'
  },
  {
    input: 'META_EDNAS_DALE_2407_Hapl.csv',
    output: 'META_EDNAS_DALE_2407_Hapl2.csv',
    name: 'Dale Sediment'
  },
  {
    input: 'META_EDNAS_EPICK_2407_Hapl.csv',
    output: 'META_EDNAS_EPICK_2407_Hapl2.csv',
    name: 'EPICK Sediment'
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
  console.log(`\n${'='.repeat(70)}`);
  console.log(`Processing ${fileInfo.name} file...`);

  const inputPath = path.join(baseDir, fileInfo.input);
  const outputPath = path.join(baseDir, fileInfo.output);

  console.log(`Input: ${inputPath}`);

  if (!fs.existsSync(inputPath)) {
    console.log(`❌ File not found: ${inputPath}`);
    return;
  }

  const content = fs.readFileSync(inputPath, 'utf-8');
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
  console.log(`Sample names: ${headers.slice(sampleStartIndex, sampleEndIndex).join(', ')}`);

  // Filter rows
  const filteredLines = [headerLine]; // Keep header
  let removedCount = 0;
  let keptCount = 0;
  const removedSpecies = [];

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
      removedSpecies.push(fields[0]);
    }
  }

  console.log(`\nResults:`);
  console.log(`  Species kept: ${keptCount}`);
  console.log(`  Species removed (all zeros): ${removedCount}`);

  if (removedCount > 0) {
    console.log(`\nRemoved species (first 10):`);
    removedSpecies.slice(0, 10).forEach(species => {
      console.log(`  - ${species}`);
    });
    if (removedCount > 10) {
      console.log(`  ... and ${removedCount - 10} more`);
    }
  }

  // Write output file
  try {
    fs.writeFileSync(outputPath, filteredLines.join('\n'), 'utf-8');
    console.log(`\n✓ Output written to: ${outputPath}`);

    // Verify the file was created
    if (fs.existsSync(outputPath)) {
      const stats = fs.statSync(outputPath);
      console.log(`✓ File verified: ${stats.size} bytes`);
    } else {
      console.log(`❌ Warning: File was written but not found`);
    }
    console.log(`Total output lines: ${filteredLines.length} (including header)`);
  } catch (error) {
    console.error(`❌ Error writing file: ${error.message}`);
  }
});

console.log(`\n${'='.repeat(70)}`);
console.log('✓ All files processed successfully!');
console.log('\nSummary of filtered files created:');
files.forEach(f => {
  const outputPath = path.join(baseDir, f.output);
  if (fs.existsSync(outputPath)) {
    const content = fs.readFileSync(outputPath, 'utf-8');
    const lineCount = content.split('\n').filter(line => line.trim() !== '').length;
    console.log(`  - ${f.output}: ${lineCount - 1} species (${lineCount} lines including header)`);
  }
});
