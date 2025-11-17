const fs = require('fs');
const path = require('path');

const inputFile = 'G:\\.shortcut-targets-by-id\\1QkmI63Nho2bLYjVC4vWXRdDRruEV5-Zl\\Ocean\\08 - Data\\06 - eDNA\\eDNA_ALGA_2507\\ALGA_EDNA_ALL_2507_Meta.csv';
const outputFile = path.join(path.dirname(inputFile), 'ALGA_EDNA_ALL_2507_Meta_Fixed.csv');

console.log('📁 Reading file:', inputFile);

// Read the entire file
const content = fs.readFileSync(inputFile, 'utf-8');

console.log('📊 File size:', content.length, 'bytes');

// First, fix the multi-line header by replacing the newline in the Coordinates field
// The header has: "Coordinates\n(Lat, Lon)" which should become "Coordinates (Lat Lon)"
let fixedContent = content;

// Find and fix the multi-line "Coordinates\n(Lat, Lon)" header
fixedContent = fixedContent.replace(/"Coordinates\r?\n\(Lat, Lon\)"/, '"Latitude","Longitude"');

console.log('✅ Fixed multi-line header');

// Now parse the CSV
const lines = fixedContent.split('\n').map(l => l.trim()).filter(l => l);

console.log('📊 Total lines after fixing:', lines.length);
console.log('📋 First 3 lines after fixing:');
lines.slice(0, 3).forEach((line, i) => console.log(`  Row ${i}:`, line.substring(0, 200)));

// Parse CSV manually to handle quoted fields with commas
function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current);

  return result;
}

// Process lines
const outputLines = [];

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  if (!line) continue;

  const fields = parseCSVLine(line);

  // For header row (first row)
  if (i === 0) {
    console.log('\n📋 Header row:', fields);

    // Header should now have "Latitude" and "Longitude" already
    const quotedFields = fields.map(f => {
      if (f.includes(',')) return `"${f}"`;
      return f;
    });
    outputLines.push(quotedFields.join(','));
  } else {
    // For data rows, split the coordinate values
    // Find the coordinates column (should contain lat/lon pair like "51.061963, -4.36475")
    let coordsIndex = -1;

    for (let j = 0; j < fields.length; j++) {
      const field = fields[j].trim();
      // Check if this field looks like coordinates (two numbers separated by comma)
      if (/^-?\d+\.\d+,\s*-?\d+\.\d+$/.test(field)) {
        coordsIndex = j;
        break;
      }
    }

    if (coordsIndex !== -1) {
      const coordsStr = fields[coordsIndex].trim();
      const parts = coordsStr.split(',').map(s => s.trim());

      if (parts.length === 2) {
        // Replace coordinates with separate lat/lon
        fields[coordsIndex] = parts[0]; // Latitude
        fields.splice(coordsIndex + 1, 0, parts[1]); // Insert Longitude
      }
    }

    // Quote fields that contain commas
    const quotedFields = fields.map(f => {
      if (f.includes(',')) return `"${f}"`;
      return f;
    });

    outputLines.push(quotedFields.join(','));
  }
}

// Write output
const outputContent = outputLines.join('\n');
fs.writeFileSync(outputFile, outputContent, 'utf-8');

console.log('\n✅ File written:', outputFile);
console.log('📊 Output lines:', outputLines.length);
console.log('📋 First 3 output lines:');
outputLines.slice(0, 3).forEach((line, i) => console.log(`  Row ${i}:`, line.substring(0, 200)));
