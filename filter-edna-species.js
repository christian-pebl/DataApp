const fs = require('fs');
const path = require('path');

// File paths
const taxoPath = String.raw`g:\.shortcut-targets-by-id\1QkmI63Nho2bLYjVC4vWXRdDRruEV5-Zl\Ocean\02 - Colabs - PEBL\01 - SeaFarms\Algapelego\Nestle project\Annual reports\Data\EDNA\ALGA_EDNA_ALL_2507_Taxo.csv`;
const credPath = String.raw`g:\.shortcut-targets-by-id\1QkmI63Nho2bLYjVC4vWXRdDRruEV5-Zl\Ocean\02 - Colabs - PEBL\01 - SeaFarms\Algapelego\Nestle project\Annual reports\Data\EDNA\ALGA_EDNA_ALL_2507_Cred.csv`;
const outputPath = String.raw`g:\.shortcut-targets-by-id\1QkmI63Nho2bLYjVC4vWXRdDRruEV5-Zl\Ocean\02 - Colabs - PEBL\01 - SeaFarms\Algapelego\Nestle project\Annual reports\Data\EDNA\ALGA_EDNA_ALL_2507_Cred_Filtered.csv`;

console.log('Reading Taxo file...');
const taxoContent = fs.readFileSync(taxoPath, 'utf8');
const taxoLines = taxoContent.split('\n');

console.log('Reading Cred file...');
const credContent = fs.readFileSync(credPath, 'utf8');
const credLines = credContent.split('\n');

// Find species with no detections in Taxo file
const speciesToRemove = new Set();

console.log('\nAnalyzing Taxo file for species with no detections...');
for (let i = 1; i < taxoLines.length; i++) {
  const line = taxoLines[i].trim();
  if (!line) continue;

  const columns = line.split(',');

  // Check if all first 6 columns are 0
  const hasDetection = columns.slice(0, 6).some(val => val === '1');

  if (!hasDetection) {
    // Get species name (last column, index 12)
    const speciesName = columns[12];
    if (speciesName && speciesName !== 'NA') {
      speciesToRemove.add(speciesName);
      console.log(`  - ${speciesName} (no detections)`);
    }
  }
}

console.log(`\nTotal species with no detections: ${speciesToRemove.size}`);

// Filter Cred file
console.log('\nFiltering Cred file...');
const filteredLines = [credLines[0]]; // Keep header
let removedCount = 0;
let keptCount = 0;
let rowNumber = 1;

for (let i = 1; i < credLines.length; i++) {
  const line = credLines[i].trim();
  if (!line) continue;

  const columns = line.split(',');
  const speciesName = columns[1]; // Species is in column 1

  if (speciesToRemove.has(speciesName)) {
    console.log(`  Removing: ${speciesName}`);
    removedCount++;
  } else {
    // Update the row number (first column) and keep the rest
    columns[0] = rowNumber;
    filteredLines.push(columns.join(','));
    rowNumber++;
    keptCount++;
  }
}

console.log(`\nRemoved ${removedCount} species`);
console.log(`Kept ${keptCount} species`);

// Write filtered file
console.log(`\nWriting filtered file to: ${outputPath}`);
fs.writeFileSync(outputPath, filteredLines.join('\n'), 'utf8');

console.log('\nDone! ✓');
