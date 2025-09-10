const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

/**
 * DIAGNOSTIC AGENT
 * Purpose: Diagnose file persistence issues
 */
class DiagnosticAgent {
  constructor() {
    this.report = {
      timestamp: new Date().toISOString(),
      issues: [],
      findings: {},
      recommendations: []
    };
  }

  async run() {
    console.log('🔍 DIAGNOSTIC AGENT STARTING...\n');
    
    await this.checkStorageBucket();
    await this.checkDatabaseRecords();
    await this.checkRLSPolicies();
    await this.analyzeCodeFlow();
    await this.generateReport();
    
    return this.report;
  }

  async checkStorageBucket() {
    console.log('📦 Checking Supabase Storage Bucket...');
    
    try {
      // List files in storage bucket
      const { data: files, error } = await supabase.storage
        .from('pins')
        .list('', {
          limit: 100,
          offset: 0
        });
      
      if (error) {
        this.report.issues.push({
          type: 'STORAGE_ERROR',
          message: 'Cannot access storage bucket',
          error: error.message
        });
      } else {
        this.report.findings.storageFiles = files?.length || 0;
        console.log(`  ✅ Found ${files?.length || 0} files in storage`);
        
        // Sample some files
        if (files && files.length > 0) {
          console.log('  Sample files:');
          files.slice(0, 5).forEach(f => {
            console.log(`    - ${f.name} (${f.metadata?.size || 'unknown'} bytes)`);
          });
        }
      }
    } catch (err) {
      this.report.issues.push({
        type: 'STORAGE_ACCESS',
        message: 'Failed to query storage',
        error: err.message
      });
    }
  }

  async checkDatabaseRecords() {
    console.log('\n💾 Checking Database Records...');
    
    try {
      // Check pins table
      const { data: pins, error: pinsError } = await supabase
        .from('pins')
        .select('*')
        .limit(10);
      
      if (pinsError) {
        this.report.issues.push({
          type: 'DATABASE_PINS',
          message: 'Cannot query pins table',
          error: pinsError.message
        });
      } else {
        this.report.findings.totalPins = pins?.length || 0;
        console.log(`  ✅ Found ${pins?.length || 0} pins in database`);
      }
      
      // Check pin_files table
      const { data: pinFiles, error: filesError } = await supabase
        .from('pin_files')
        .select(`
          *,
          pins!inner(user_id)
        `)
        .limit(10);
      
      if (filesError) {
        this.report.issues.push({
          type: 'DATABASE_PIN_FILES',
          message: 'Cannot query pin_files table',
          error: filesError.message
        });
      } else {
        this.report.findings.totalPinFiles = pinFiles?.length || 0;
        console.log(`  ✅ Found ${pinFiles?.length || 0} file records in database`);
        
        // Check for orphaned records
        const orphaned = pinFiles?.filter(f => !f.pins) || [];
        if (orphaned.length > 0) {
          this.report.issues.push({
            type: 'ORPHANED_FILES',
            message: `Found ${orphaned.length} orphaned file records`,
            data: orphaned
          });
        }
      }
    } catch (err) {
      this.report.issues.push({
        type: 'DATABASE_ACCESS',
        message: 'Failed to query database',
        error: err.message
      });
    }
  }

  async checkRLSPolicies() {
    console.log('\n🔐 Checking RLS Policies...');
    
    try {
      // Test RLS by attempting operations
      const testUserId = '1f1b8955-ae0e-4fce-9a2f-4f417d06ce44'; // Test user ID
      
      // Try to read pins for specific user
      const { data: userPins, error: userPinsError } = await supabase
        .from('pins')
        .select('*')
        .eq('user_id', testUserId);
      
      if (userPinsError) {
        this.report.issues.push({
          type: 'RLS_PINS',
          message: 'RLS might be blocking pins access',
          error: userPinsError.message
        });
      } else {
        console.log(`  ✅ RLS allows reading pins (found ${userPins?.length || 0} for test user)`);
      }
      
      // Try to read pin_files
      if (userPins && userPins.length > 0) {
        const { data: userFiles, error: userFilesError } = await supabase
          .from('pin_files')
          .select('*')
          .eq('pin_id', userPins[0].id);
        
        if (userFilesError) {
          this.report.issues.push({
            type: 'RLS_PIN_FILES',
            message: 'RLS might be blocking pin_files access',
            error: userFilesError.message
          });
        } else {
          console.log(`  ✅ RLS allows reading pin_files (found ${userFiles?.length || 0})`);
        }
      }
    } catch (err) {
      this.report.issues.push({
        type: 'RLS_CHECK',
        message: 'Failed to check RLS policies',
        error: err.message
      });
    }
  }

  async analyzeCodeFlow() {
    console.log('\n📝 Analyzing Code Flow...');
    
    // Check if the file service exists
    const fileServicePath = path.join(__dirname, '../src/lib/supabase/file-storage-service.ts');
    if (fs.existsSync(fileServicePath)) {
      console.log('  ✅ file-storage-service.ts exists');
      
      // Read and check for common issues
      const content = fs.readFileSync(fileServicePath, 'utf8');
      
      // Check for user_id handling
      if (!content.includes('user_id') && !content.includes('userId')) {
        this.report.issues.push({
          type: 'CODE_USER_ID',
          message: 'file-storage-service might not be handling user_id properly',
          file: 'file-storage-service.ts'
        });
      }
      
      // Check for proper error handling
      if (!content.includes('try') || !content.includes('catch')) {
        this.report.issues.push({
          type: 'CODE_ERROR_HANDLING',
          message: 'file-storage-service might lack proper error handling',
          file: 'file-storage-service.ts'
        });
      }
    } else {
      this.report.issues.push({
        type: 'CODE_MISSING_SERVICE',
        message: 'file-storage-service.ts not found',
        severity: 'high'
      });
    }
    
    // Check the main page file
    const pageFilePath = path.join(__dirname, '../src/app/map-drawing/page.tsx');
    if (fs.existsSync(pageFilePath)) {
      console.log('  ✅ map-drawing/page.tsx exists');
      
      const content = fs.readFileSync(pageFilePath, 'utf8');
      
      // Check for loadDatabaseData function
      if (content.includes('loadDatabaseData')) {
        console.log('  ✅ loadDatabaseData function found');
        
        // Check if it loads pin files
        if (!content.includes('getPinFiles') && !content.includes('pin_files')) {
          this.report.issues.push({
            type: 'CODE_LOAD_FILES',
            message: 'loadDatabaseData might not be loading pin files',
            file: 'map-drawing/page.tsx'
          });
        }
      }
    }
  }

  async generateReport() {
    console.log('\n📊 Generating Diagnostic Report...\n');
    
    // Add recommendations based on issues found
    if (this.report.issues.length === 0) {
      this.report.recommendations.push('No critical issues found. Check implementation details.');
    } else {
      this.report.issues.forEach(issue => {
        switch (issue.type) {
          case 'STORAGE_ERROR':
            this.report.recommendations.push('Fix storage bucket permissions or create bucket if missing');
            break;
          case 'DATABASE_PIN_FILES':
            this.report.recommendations.push('Check if pin_files table exists and has proper schema');
            break;
          case 'RLS_PIN_FILES':
            this.report.recommendations.push('Update RLS policies to allow authenticated users to read their pin files');
            break;
          case 'CODE_USER_ID':
            this.report.recommendations.push('Ensure user_id is properly passed and stored with file uploads');
            break;
          case 'CODE_LOAD_FILES':
            this.report.recommendations.push('Add pin files loading to loadDatabaseData function');
            break;
          case 'ORPHANED_FILES':
            this.report.recommendations.push('Clean up orphaned file records and add cascade delete');
            break;
        }
      });
    }
    
    // Save report
    const reportPath = path.join(__dirname, '../diagnostic-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(this.report, null, 2));
    
    // Print summary
    console.log('=' * 50);
    console.log('DIAGNOSTIC SUMMARY');
    console.log('=' * 50);
    console.log(`Issues Found: ${this.report.issues.length}`);
    console.log(`Storage Files: ${this.report.findings.storageFiles || 0}`);
    console.log(`Database Pins: ${this.report.findings.totalPins || 0}`);
    console.log(`Database Files: ${this.report.findings.totalPinFiles || 0}`);
    
    if (this.report.issues.length > 0) {
      console.log('\n🚨 Critical Issues:');
      this.report.issues.forEach((issue, i) => {
        console.log(`  ${i + 1}. ${issue.type}: ${issue.message}`);
      });
    }
    
    if (this.report.recommendations.length > 0) {
      console.log('\n💡 Recommendations:');
      this.report.recommendations.forEach((rec, i) => {
        console.log(`  ${i + 1}. ${rec}`);
      });
    }
    
    console.log('\n📄 Full report saved to diagnostic-report.json');
  }
}

// Run the diagnostic agent
const agent = new DiagnosticAgent();
agent.run().catch(console.error);