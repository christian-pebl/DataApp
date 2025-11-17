const fs = require('fs');

const inputFile = 'g:\\.shortcut-targets-by-id\\1QkmI63Nho2bLYjVC4vWXRdDRruEV5-Zl\\Ocean\\08 - Data\\06 - eDNA\\eDNA_NORF_2507\\NORF_EDNAS_ALL_2507_Hapl.csv';
const outputFile = 'g:\\.shortcut-targets-by-id\\1QkmI63Nho2bLYjVC4vWXRdDRruEV5-Zl\\Ocean\\08 - Data\\06 - eDNA\\eDNA_NORF_2507\\NORF_EDNAS_ALL_2507_Hapl2.csv';

console.log('Reading input file...');
const lines = fs.readFileSync(inputFile, 'utf8').split('\n');
const header = lines[0];
const filteredLines = [header];

let removedCount = 0;
let keptCount = 0;

console.log('Processing rows...');
for (let i = 1; i < lines.length; i++) {
  const line = lines[i].trim();
  if (!line) continue;

  const cells = line.split(',');
  if (cells.length < 7) continue;

  // Check columns 1-6 (indices 1-6 after splitting by comma)
  // Column 0 is species name, columns 1-6 are the sample data
  const sampleValues = cells.slice(1, 7);
  const hasNonZero = sampleValues.some(val => val && val !== '0' && val.trim() !== '');

  if (hasNonZero) {
    filteredLines.push(line);
    keptCount++;
  } else {
    removedCount++;
  }
}

console.log('Writing output file...');
fs.writeFileSync(outputFile, filteredLines.join('\n'));

console.log('\n=== Results ===');
console.log('Removed ' + removedCount + ' rows with all zeros');
console.log('Kept ' + keptCount + ' rows with non-zero values');
console.log('File created: NORF_EDNAS_ALL_2507_Hapl2.csv');
