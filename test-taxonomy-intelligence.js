/**
 * Test script to verify intelligent taxonomy parsing
 * Tests the categorization and grouping functions
 */

// Import the categorization logic
function categorizeSample(sampleName) {
  const lower = sampleName.toLowerCase();

  // Check for control patterns
  if (lower.includes('_c_') || lower.includes('control')) {
    return 'control';
  }

  // Check for farm patterns
  if (lower.includes('_f_') || lower.includes('farm')) {
    return 'farm';
  }

  return 'unknown';
}

// Test samples from both files
const testSamples = {
  NORF: [
    'NORF_Control_1',
    'NORF_Control_2',
    'NORF_Control_3',
    'NORF_Farm_1',
    'NORF_Farm_2',
    'NORF_Farm_3'
  ],
  ALGA: [
    'ALGA_C_S',
    'ALGA_C_W',
    'ALGA_C_E',
    'ALGA_F_L',
    'ALGA_F_M',
    'ALGA_F_AS'
  ]
};

console.log('═══════════════════════════════════════════════════════');
console.log('Testing Intelligent Sample Categorization');
console.log('═══════════════════════════════════════════════════════\n');

for (const [fileType, samples] of Object.entries(testSamples)) {
  console.log(`\n${fileType} File Samples:`);
  console.log('-'.repeat(50));

  const categorized = {
    control: [],
    farm: [],
    unknown: []
  };

  samples.forEach(sample => {
    const category = categorizeSample(sample);
    categorized[category].push(sample);
    console.log(`  ${sample.padEnd(20)} → ${category}`);
  });

  console.log(`\nGrouping Summary for ${fileType}:`);
  console.log(`  Control sites: ${categorized.control.length} - ${categorized.control.join(', ')}`);
  console.log(`  Farm sites: ${categorized.farm.length} - ${categorized.farm.join(', ')}`);
  console.log(`  Unknown sites: ${categorized.unknown.length}${categorized.unknown.length > 0 ? ` - ${categorized.unknown.join(', ')}` : ''}`);

  // Verify we have both control and farm
  const hasPattern = categorized.control.length > 0 && categorized.farm.length > 0;
  console.log(`  Control/Farm pattern detected: ${hasPattern ? '✅ YES' : '❌ NO'}`);
}

console.log('\n═══════════════════════════════════════════════════════');
console.log('Test Complete');
console.log('═══════════════════════════════════════════════════════');
