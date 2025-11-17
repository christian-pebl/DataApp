const fs = require('fs');
const path = require('path');
const readline = require('readline');

const inputFile = 'g:\\.shortcut-targets-by-id\\1QkmI63Nho2bLYjVC4vWXRdDRruEV5-Zl\\Ocean\\08 - Data\\06 - eDNA\\eDNA_NORF_2507\\NORF_EDNA_ALL_2507_Meta.csv';
const outputFile = 'g:\\.shortcut-targets-by-id\\1QkmI63Nho2bLYjVC4vWXRdDRruEV5-Zl\\Ocean\\08 - Data\\06 - eDNA\\eDNA_NORF_2507\\NORF_EDNA_ALL_2507_Meta_Fixed.csv';

console.log('Starting to process NORF eDNA file...');
console.log('Input:', inputFile);
console.log('Output:', outputFile);

const outputStream = fs.createWriteStream(outputFile);
let lineCount = 0;
let coordColumnIndex = -1;
let isFirstLine = true;
let headerBuffer = '';
let inMultilineField = false;

const rl = readline.createInterface({
  input: fs.createReadStream(inputFile),
  crlfDelay: Infinity
});

rl.on('line', (line) => {
  lineCount++;

  // Handle multi-line quoted fields in header
  if (isFirstLine || inMultilineField) {
    headerBuffer += (headerBuffer ? '\n' : '') + line;

    // Count quotes to determine if we're still in a multi-line field
    const quoteCount = (headerBuffer.match(/"/g) || []).length;

    if (quoteCount % 2 !== 0) {
      // Odd number of quotes means we're still in a multi-line field
      inMultilineField = true;
      return;
    } else {
      inMultilineField = false;
      line = headerBuffer;
      headerBuffer = '';
    }
  }

  // Parse the CSV line (handle quoted fields)
  const fields = [];
  let currentField = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      fields.push(currentField);
      currentField = '';
    } else {
      currentField += char;
    }
  }
  fields.push(currentField); // Add the last field

  if (isFirstLine) {
    // Find the coordinates column index
    coordColumnIndex = fields.findIndex(field =>
      field.includes('Coordinates') || field.includes('Lat') || field.includes('Lon')
    );

    if (coordColumnIndex === -1) {
      console.error('ERROR: Could not find Coordinates column!');
      console.error('Available fields:', fields);
      process.exit(1);
    }

    console.log(`Found Coordinates column at index ${coordColumnIndex}`);
    console.log(`Original field: "${fields[coordColumnIndex]}"`);

    // Replace the coordinates column header with Latitude and Longitude
    fields[coordColumnIndex] = 'Latitude';
    fields.splice(coordColumnIndex + 1, 0, 'Longitude');

    isFirstLine = false;
  } else if (line.trim() === '' || fields.every(f => f.trim() === '')) {
    // Empty line - keep as is
    outputStream.write(line + '\n');
    return;
  } else {
    // Data row - split the coordinates
    const coordField = fields[coordColumnIndex];

    if (coordField && coordField.includes(',')) {
      // Extract coordinates from quoted string like "53.028183, 0.972183"
      const coordStr = coordField.replace(/"/g, '').trim();
      const parts = coordStr.split(',').map(s => s.trim());

      if (parts.length === 2) {
        const latitude = parts[0];
        const longitude = parts[1];

        // Replace the coordinates field with separate lat/lon
        fields[coordColumnIndex] = latitude;
        fields.splice(coordColumnIndex + 1, 0, longitude);
      } else {
        console.warn(`Warning: Line ${lineCount} has invalid coordinate format: "${coordField}"`);
        // Insert empty longitude field
        fields.splice(coordColumnIndex + 1, 0, '');
      }
    } else {
      // No coordinates or invalid format - insert empty longitude field
      fields.splice(coordColumnIndex + 1, 0, '');
    }
  }

  // Write the modified line
  // Quote fields that contain commas or quotes
  const outputFields = fields.map(field => {
    if (field.includes(',') || field.includes('"') || field.includes('\n')) {
      return `"${field.replace(/"/g, '""')}"`;
    }
    return field;
  });

  outputStream.write(outputFields.join(',') + '\n');
});

rl.on('close', () => {
  outputStream.end();
  console.log(`\nProcessing complete!`);
  console.log(`Total lines processed: ${lineCount}`);
  console.log(`Output saved to: ${outputFile}`);
});

rl.on('error', (err) => {
  console.error('Error reading input file:', err);
  process.exit(1);
});

outputStream.on('error', (err) => {
  console.error('Error writing output file:', err);
  process.exit(1);
});
