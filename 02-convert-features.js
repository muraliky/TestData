#!/usr/bin/env node
/**
 * Script 02: Convert Feature Files
 * - Copies all .feature files from source to target
 * - Converts ALL And/But keywords to Given/When/Then
 * 
 * Usage: node scripts/02-convert-features.js <config-path>
 * Example: node scripts/02-convert-features.js ./migration-config.json
 */

const fs = require('fs');
const path = require('path');

// Get config path from arguments
const configPath = process.argv[2] || './migration-config.json';

console.log('='.repeat(60));
console.log('  SCRIPT 02: FEATURE FILE CONVERSION');
console.log('='.repeat(60));

// Load configuration
if (!fs.existsSync(configPath)) {
  console.log('\n[ERROR] Configuration file not found: ' + configPath);
  console.log('\nUsage: node scripts/02-convert-features.js <config-path>');
  process.exit(1);
}

let config;
try {
  const content = fs.readFileSync(configPath, 'utf8');
  const cleanContent = content.replace(/"\/\/[^"]*":\s*"[^"]*",?\s*/g, '');
  config = JSON.parse(cleanContent);
} catch (err) {
  console.log('\n[ERROR] Failed to parse configuration: ' + err.message);
  process.exit(1);
}

// Build paths from config
const sourceRoot = config.source.rootDir;
const targetRoot = config.target.rootDir;
const sourceFeaturesPath = config.source.features?.path || 'features';
const targetFeaturesPath = config.target.features || 'features';

const sourceDir = path.join(sourceRoot, sourceFeaturesPath);
const targetDir = path.join(targetRoot, targetFeaturesPath);

console.log('\n[INFO] Configuration loaded');
console.log('  Source features: ' + sourceDir);
console.log('  Target features: ' + targetDir);

// Validate source exists
if (!fs.existsSync(sourceDir)) {
  console.log('\n[ERROR] Source features directory not found: ' + sourceDir);
  console.log('  Please check source.features.path in your configuration');
  process.exit(1);
}

// Get folder mapping from config
const folderMapping = config.options?.features?.folderMapping || {};

let totalFiles = 0;
let totalConversions = 0;
const convertedFiles = [];
const errors = [];

// Function to convert folder name
function convertFolderName(name) {
  if (folderMapping[name]) {
    return folderMapping[name];
  }
  // Convert to kebab-case
  return name
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1-$2')
    .replace(/\s+/g, '-')
    .replace(/\.+/g, '-')
    .replace(/_+/g, '-')
    .replace(/--+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();
}

// Function to convert And/But keywords
function convertFeatureContent(content) {
  const lines = content.split('\n');
  let lastKeyword = '';
  const convertedLines = [];
  let conversions = 0;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Match Given, When, Then
    const keywordMatch = line.match(/^(\s*)(Given|When|Then)\s+(.*)$/);
    if (keywordMatch) {
      lastKeyword = keywordMatch[2];
      convertedLines.push(line);
      continue;
    }
    
    // Match And or But - replace with last keyword
    const andButMatch = line.match(/^(\s*)(And|But)\s+(.*)$/);
    if (andButMatch && lastKeyword) {
      const indent = andButMatch[1];
      const stepText = andButMatch[3];
      convertedLines.push(indent + lastKeyword + ' ' + stepText);
      conversions++;
      continue;
    }
    
    // Reset on Scenario/Background/Feature
    if (line.match(/^\s*(Scenario|Background|Feature|Examples|Rule)/)) {
      lastKeyword = '';
    }
    
    convertedLines.push(line);
  }
  
  return {
    content: convertedLines.join('\n'),
    conversions: conversions
  };
}

// Process directory recursively
function processDirectory(srcPath, tgtPath) {
  if (!fs.existsSync(srcPath)) {
    return;
  }
  
  const items = fs.readdirSync(srcPath);
  
  items.forEach(item => {
    const srcItemPath = path.join(srcPath, item);
    const stats = fs.statSync(srcItemPath);
    
    if (stats.isDirectory()) {
      // Convert folder name
      const convertedName = convertFolderName(item);
      const tgtItemPath = path.join(tgtPath, convertedName);
      
      // Create target directory
      if (!fs.existsSync(tgtItemPath)) {
        fs.mkdirSync(tgtItemPath, { recursive: true });
      }
      
      // Recurse
      processDirectory(srcItemPath, tgtItemPath);
    } else if (item.endsWith('.feature')) {
      try {
        // Read source file
        const content = fs.readFileSync(srcItemPath, 'utf8');
        
        // Convert And/But keywords
        const result = convertFeatureContent(content);
        
        // Ensure target directory exists
        if (!fs.existsSync(tgtPath)) {
          fs.mkdirSync(tgtPath, { recursive: true });
        }
        
        // Write to target
        const tgtFilePath = path.join(tgtPath, item);
        fs.writeFileSync(tgtFilePath, result.content);
        
        totalFiles++;
        totalConversions += result.conversions;
        
        convertedFiles.push({
          source: srcItemPath,
          target: tgtFilePath,
          conversions: result.conversions
        });
        
        if (result.conversions > 0) {
          console.log('  [CONVERTED] ' + item + ' (' + result.conversions + ' And/But replaced)');
        } else {
          console.log('  [COPIED] ' + item + ' (no changes needed)');
        }
      } catch (err) {
        errors.push({ file: srcItemPath, error: err.message });
        console.log('  [ERROR] ' + item + ' - ' + err.message);
      }
    }
  });
}

console.log('\n[INFO] Processing feature files...\n');
processDirectory(sourceDir, targetDir);

// Summary
console.log('\n' + '='.repeat(60));
console.log('  CONVERSION COMPLETE');
console.log('='.repeat(60));
console.log('\nSummary:');
console.log('  Files processed: ' + totalFiles);
console.log('  And/But keywords converted: ' + totalConversions);
console.log('  Errors: ' + errors.length);

if (errors.length > 0) {
  console.log('\nErrors encountered:');
  errors.forEach(e => console.log('  - ' + e.file + ': ' + e.error));
}

// Write report
const report = {
  timestamp: new Date().toISOString(),
  sourceDirectory: sourceDir,
  targetDirectory: targetDir,
  totalFiles: totalFiles,
  totalConversions: totalConversions,
  files: convertedFiles,
  errors: errors
};

const reportPath = path.join(targetRoot, 'reports', 'feature-conversion-report.json');
const reportDir = path.dirname(reportPath);
if (!fs.existsSync(reportDir)) {
  fs.mkdirSync(reportDir, { recursive: true });
}
fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
console.log('\nReport saved: ' + reportPath);

console.log('\nNext steps:');
console.log('  1. Review the converted feature files in: ' + targetDir);
console.log('  2. Run: npx bddgen (to verify syntax)');
console.log('  3. Run: node scripts/03-generate-pages.js ' + configPath);
