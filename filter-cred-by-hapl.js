const fs = require('fs');

const hapl2File = 'g:\\.shortcut-targets-by-id\\1QkmI63Nho2bLYjVC4vWXRdDRruEV5-Zl\\Ocean\\08 - Data\\06 - eDNA\\eDNA_NORF_2507\\NORF_EDNAS_ALL_2507_Hapl2.csv';
const credFile = 'g:\\.shortcut-targets-by-id\\1QkmI63Nho2bLYjVC4vWXRdDRruEV5-Zl\\Ocean\\08 - Data\\06 - eDNA\\eDNA_NORF_2507\\NORF_EDNAS_ALL_2507_Cred.csv';
const outputFile = 'g:\\.shortcut-targets-by-id\\1QkmI63Nho2bLYjVC4vWXRdDRruEV5-Zl\\Ocean\\08 - Data\\06 - eDNA\\eDNA_NORF_2507\\NORF_EDNAS_ALL_2507_Cred2.csv';

console.log('Reading Hapl2 file to get species list...');
const hapl2Lines = fs.readFileSync(hapl2File, 'utf8').split('\n');
const hapl2Species = new Set();

// Get species names from Hapl2 file (first column)
for (let i = 1; i < hapl2Lines.length; i++) {
  const line = hapl2Lines[i].trim();
  if (!line) continue;

  const cells = line.split(',');
  if (cells.length > 0 && cells[0]) {
    hapl2Species.add(cells[0].trim());
  }
}

console.log('Found ' + hapl2Species.size + ' species in Hapl2 file');
console.log('Species list:', Array.from(hapl2Species).join(', '));

console.log('\nReading Cred file...');
const credLines = fs.readFileSync(credFile, 'utf8').split('\n');
const header = credLines[0];
const filteredLines = [header];

let keptCount = 0;
let removedCount = 0;

console.log('Filtering Cred file...');
for (let i = 1; i < credLines.length; i++) {
  const line = credLines[i].trim();
  if (!line) continue;

  const cells = line.split(',');
  if (cells.length < 2) continue;

  const speciesName = cells[1].trim(); // species column is index 1 (after the row number)

  if (hapl2Species.has(speciesName)) {
    filteredLines.push(line);
    keptCount++;
    console.log('  ✓ Keeping: ' + speciesName);
  } else {
    removedCount++;
    console.log('  ✗ Removing: ' + speciesName);
  }
}

console.log('\nWriting output file...');
fs.writeFileSync(outputFile, filteredLines.join('\n'));

console.log('\n=== Results ===');
console.log('Kept ' + keptCount + ' species that match Hapl2');
console.log('Removed ' + removedCount + ' species not in Hapl2');
console.log('File created: NORF_EDNAS_ALL_2507_Cred2.csv');
