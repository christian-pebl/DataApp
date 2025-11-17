const fs = require('fs');

const inputFile = 'g:\\.shortcut-targets-by-id\\1QkmI63Nho2bLYjVC4vWXRdDRruEV5-Zl\\Ocean\\08 - Data\\06 - eDNA\\eDNA_NORF_2507\\NORF_EDNAS_ALL_2507_Meta.csv';
const outputFile = 'g:\\.shortcut-targets-by-id\\1QkmI63Nho2bLYjVC4vWXRdDRruEV5-Zl\\Ocean\\08 - Data\\06 - eDNA\\eDNA_NORF_2507\\NORF_EDNAS_ALL_2507_Meta2.csv';

console.log('Reading NORF Meta file...');
const lines = fs.readFileSync(inputFile, 'utf8').split('\n');
const convertedLines = [];

// Conversion mapping
const nameMap = {
  'NORF_Control_1': 'NORF_C_1',
  'NORF_Control_2': 'NORF_C_2',
  'NORF_Control_3': 'NORF_C_3',
  'NORF_Farm_1': 'NORF_F_1',
  'NORF_Farm_2': 'NORF_F_2',
  'NORF_Farm_3': 'NORF_F_3'
};

// Keep header as-is
convertedLines.push(lines[0]);

console.log('Converting sample names...');
for (let i = 1; i < lines.length; i++) {
  const line = lines[i].trim();
  if (!line) {
    convertedLines.push('');
    continue;
  }

  const cells = line.split(',');
  
  // Convert Sample Name (column index 1)
  if (cells[1] && nameMap[cells[1]]) {
    console.log('  Converting: ' + cells[1] + ' → ' + nameMap[cells[1]]);
    cells[1] = nameMap[cells[1]];
  }
  
  // Convert Station (column index 5)
  if (cells[5] && nameMap[cells[5]]) {
    cells[5] = nameMap[cells[5]];
  }
  
  convertedLines.push(cells.join(','));
}

console.log('\nWriting converted file...');
fs.writeFileSync(outputFile, convertedLines.join('\n'));

console.log('\n=== Conversion Complete ===');
console.log('Input:  NORF_EDNAS_ALL_2507_Meta.csv');
console.log('Output: NORF_EDNAS_ALL_2507_Meta2.csv');
console.log('Converted 6 sample names to abbreviated format');
