/**
 * Test script to debug taxonomy file parsing
 * Compares NORF vs ALGA file parsing
 */

const fs = require('fs');
const Papa = require('papaparse');

const NORF_FILE = 'g:\\.shortcut-targets-by-id\\1QkmI63Nho2bLYjVC4vWXRdDRruEV5-Zl\\Ocean\\08 - Data\\06 - eDNA\\eDNA_NORF_2507\\NORF_EDNA_ALL_2507_Taxo.csv';
const ALGA_FILE = 'g:\\.shortcut-targets-by-id\\1QkmI63Nho2bLYjVC4vWXRdDRruEV5-Zl\\Ocean\\08 - Data\\06 - eDNA\\eDNA_ALGA_2507\\ALGA_EDNA_ALL_2507_Taxo.csv';

function identifySampleColumns(headers) {
  const taxonomyColumns = ['kingdom', 'phylum', 'class', 'order', 'family', 'genus', 'species'];
  const metadataColumns = ['date', 'time', 'sample', 'replicate', 'subset'];

  const sampleColumns = headers.filter(h => {
    const normalized = h.toLowerCase().trim();
    return !taxonomyColumns.includes(normalized) && !metadataColumns.includes(normalized);
  });

  return sampleColumns;
}

function testFile(filePath, label) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Testing ${label}: ${filePath}`);
  console.log('='.repeat(60));

  const csvContent = fs.readFileSync(filePath, 'utf8');

  const result = Papa.parse(csvContent, {
    header: true,
    skipEmptyLines: true,
    dynamicTyping: false, // Keep everything as strings initially
    transformHeader: (header) => {
      // Log each header as it's being transformed
      console.log(`[HEADER TRANSFORM] Original: "${header}"`);
      return header.trim();
    }
  });

  console.log('\n[PARSE RESULT]');
  console.log('Errors:', result.errors.length);
  if (result.errors.length > 0) {
    console.log('First error:', result.errors[0]);
  }

  const headers = result.meta.fields || [];
  console.log('\n[HEADERS]');
  console.log('Total headers:', headers.length);
  console.log('Headers:', headers);

  const sampleColumns = identifySampleColumns(headers);
  console.log('\n[SAMPLE COLUMNS IDENTIFIED]');
  console.log('Total sample columns:', sampleColumns.length);
  console.log('Sample columns:', sampleColumns);

  // Check first data row
  if (result.data.length > 0) {
    console.log('\n[FIRST DATA ROW]');
    const firstRow = result.data[0];
    console.log('Keys in first row:', Object.keys(firstRow));
    console.log('First row data:', firstRow);

    console.log('\n[SAMPLE COLUMN VALUES IN FIRST ROW]');
    sampleColumns.forEach(col => {
      console.log(`  ${col}: "${firstRow[col]}" (type: ${typeof firstRow[col]})`);
    });
  }

  // Count valid phylum rows
  const phylumIndex = headers.findIndex(h => h.toLowerCase() === 'phylum');
  if (phylumIndex !== -1) {
    const phylumColName = headers[phylumIndex];
    let validPhylaCount = 0;
    let invalidPhylaCount = 0;

    result.data.forEach(row => {
      const phylum = row[phylumColName];
      if (phylum && phylum.trim() !== '' && phylum.toLowerCase() !== 'na') {
        validPhylaCount++;
      } else {
        invalidPhylaCount++;
      }
    });

    console.log('\n[PHYLUM DATA]');
    console.log('Valid phyla rows:', validPhylaCount);
    console.log('Invalid/empty phyla rows:', invalidPhylaCount);
  }

  return { headers, sampleColumns, data: result.data };
}

// Test both files
const norfResult = testFile(NORF_FILE, 'NORF');
const algaResult = testFile(ALGA_FILE, 'ALGA');

// Compare results
console.log(`\n${'='.repeat(60)}`);
console.log('COMPARISON');
console.log('='.repeat(60));
console.log('NORF sample columns:', norfResult.sampleColumns.length, '->', norfResult.sampleColumns);
console.log('ALGA sample columns:', algaResult.sampleColumns.length, '->', algaResult.sampleColumns);

if (norfResult.sampleColumns.length !== algaResult.sampleColumns.length) {
  console.log('\n⚠️  DIFFERENT NUMBER OF SAMPLE COLUMNS DETECTED!');
} else {
  console.log('\n✅ Same number of sample columns detected');
}
