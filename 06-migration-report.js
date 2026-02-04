#!/usr/bin/env node
/**
 * Script 06: Migration Report
 * - Generates a comprehensive migration status report
 * - Lists all migrated files
 * - Shows items needing manual review
 * 
 * Usage: node scripts/06-migration-report.js <config-path>
 * Example: node scripts/06-migration-report.js ./migration-config.json
 */

const fs = require('fs');
const path = require('path');

// Get config path from arguments
const configPath = process.argv[2] || './migration-config.json';

console.log('='.repeat(60));
console.log('  SCRIPT 06: MIGRATION REPORT');
console.log('='.repeat(60));

// Load configuration
if (!fs.existsSync(configPath)) {
  console.log('\n[ERROR] Configuration file not found: ' + configPath);
  console.log('\nUsage: node scripts/06-migration-report.js <config-path>');
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

const targetRoot = config.target.rootDir;

console.log('\n[INFO] Configuration loaded');
console.log('  Target project: ' + targetRoot);

// Validate target exists
if (!fs.existsSync(targetRoot)) {
  console.log('\n[ERROR] Target project not found: ' + targetRoot);
  console.log('  Please run the setup script first');
  process.exit(1);
}

const report = {
  timestamp: new Date().toISOString(),
  targetProject: targetRoot,
  pages: { total: 0, needsReview: 0, files: [] },
  steps: { total: 0, totalSteps: 0, files: [] },
  features: { total: 0, converted: 0, files: [] },
  issues: [],
  nextSteps: []
};

// Count files recursively
function countFiles(dir, extension, results = []) {
  if (!fs.existsSync(dir)) return results;
  
  const items = fs.readdirSync(dir);
  items.forEach(item => {
    const fullPath = path.join(dir, item);
    const stats = fs.statSync(fullPath);
    
    if (stats.isDirectory()) {
      countFiles(fullPath, extension, results);
    } else if (item.endsWith(extension)) {
      results.push(fullPath);
    }
  });
  
  return results;
}

// Count TODO comments
function countTodos(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const matches = content.match(/TODO/g);
  return matches ? matches.length : 0;
}

// Check for XPath in file
function hasXPath(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  return content.includes('xpath=') || content.includes('XPath') || content.includes('TODO: Convert XPath');
}

// Check for And/But in feature files
function hasAndBut(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  
  for (const line of lines) {
    if (line.match(/^\s*(And|But)\s+/)) {
      return true;
    }
  }
  return false;
}

// Analyze pages
console.log('\n[INFO] Analyzing page classes...');
const pagesDir = path.join(targetRoot, config.target.pages || 'src/pages');
const pageFiles = countFiles(pagesDir, '.page.ts');

pageFiles.forEach(file => {
  const todos = countTodos(file);
  const xpath = hasXPath(file);
  
  report.pages.total++;
  if (todos > 0 || xpath) {
    report.pages.needsReview++;
  }
  
  report.pages.files.push({
    file: file.replace(targetRoot, '.'),
    todos: todos,
    hasXPath: xpath,
    status: (todos === 0 && !xpath) ? 'COMPLETE' : 'NEEDS REVIEW'
  });
});

// Analyze steps
console.log('[INFO] Analyzing step definitions...');
const stepsDir = path.join(targetRoot, config.target.steps || 'src/steps');
const stepFiles = countFiles(stepsDir, '.steps.ts');

stepFiles.forEach(file => {
  const content = fs.readFileSync(file, 'utf8');
  const stepCount = (content.match(/(Given|When|Then)\s*\(/g) || []).length;
  const todos = countTodos(file);
  
  report.steps.total++;
  report.steps.totalSteps += stepCount;
  
  report.steps.files.push({
    file: file.replace(targetRoot, '.'),
    steps: stepCount,
    todos: todos,
    status: todos === 0 ? 'COMPLETE' : 'NEEDS REVIEW'
  });
});

// Analyze features
console.log('[INFO] Analyzing feature files...');
const featuresDir = path.join(targetRoot, config.target.features || 'features');
const featureFiles = countFiles(featuresDir, '.feature');

featureFiles.forEach(file => {
  const andBut = hasAndBut(file);
  
  report.features.total++;
  if (!andBut) {
    report.features.converted++;
  }
  
  report.features.files.push({
    file: file.replace(targetRoot, '.'),
    hasAndBut: andBut,
    status: andBut ? 'HAS AND/BUT' : 'CONVERTED'
  });
});

// Check for common issues
console.log('[INFO] Checking for issues...');

if (!fs.existsSync(path.join(targetRoot, 'src/steps/fixtures.ts'))) {
  report.issues.push('Missing fixtures.ts - run script 05');
}

if (!fs.existsSync(path.join(targetRoot, 'playwright.config.ts'))) {
  report.issues.push('Missing playwright.config.ts - run script 01');
}

if (!fs.existsSync(path.join(targetRoot, 'package.json'))) {
  report.issues.push('Missing package.json - run script 01');
}

const unconvertedFeatures = report.features.files.filter(f => f.hasAndBut);
if (unconvertedFeatures.length > 0) {
  report.issues.push(unconvertedFeatures.length + ' feature file(s) still have And/But keywords');
}

const pagesWithXPath = report.pages.files.filter(f => f.hasXPath);
if (pagesWithXPath.length > 0) {
  report.issues.push(pagesWithXPath.length + ' page file(s) have XPath needing conversion');
}

// Generate next steps
if (report.issues.length > 0) {
  report.nextSteps.push('Fix the issues listed above');
}
report.nextSteps.push('Run: npm install');
report.nextSteps.push('Run: npx bddgen');
report.nextSteps.push('Run: npm test');
report.nextSteps.push('Fix any failing tests');

// Print report
console.log('\n' + '='.repeat(60));
console.log('  MIGRATION STATUS REPORT');
console.log('='.repeat(60));

console.log('\n--- PAGE CLASSES ---');
console.log('Total: ' + report.pages.total);
console.log('Needs Review: ' + report.pages.needsReview);
console.log('Complete: ' + (report.pages.total - report.pages.needsReview));
if (report.pages.needsReview > 0) {
  console.log('\nFiles needing review:');
  report.pages.files.filter(f => f.status === 'NEEDS REVIEW').forEach(f => {
    console.log('  - ' + f.file + ' (' + f.todos + ' TODOs' + (f.hasXPath ? ', has XPath' : '') + ')');
  });
}

console.log('\n--- STEP DEFINITIONS ---');
console.log('Total files: ' + report.steps.total);
console.log('Total steps: ' + report.steps.totalSteps);
const stepsWithTodos = report.steps.files.filter(f => f.todos > 0);
if (stepsWithTodos.length > 0) {
  console.log('\nFiles with TODOs:');
  stepsWithTodos.forEach(f => {
    console.log('  - ' + f.file + ' (' + f.todos + ' TODOs)');
  });
}

console.log('\n--- FEATURE FILES ---');
console.log('Total: ' + report.features.total);
console.log('Converted: ' + report.features.converted);
console.log('Unconverted: ' + (report.features.total - report.features.converted));
if (unconvertedFeatures.length > 0) {
  console.log('\nFiles still with And/But:');
  unconvertedFeatures.forEach(f => {
    console.log('  - ' + f.file);
  });
}

console.log('\n--- ISSUES ---');
if (report.issues.length === 0) {
  console.log('No critical issues found');
} else {
  report.issues.forEach(issue => {
    console.log('  [!] ' + issue);
  });
}

console.log('\n--- NEXT STEPS ---');
report.nextSteps.forEach((step, i) => {
  console.log('  ' + (i + 1) + '. ' + step);
});

// Calculate progress
const totalItems = report.pages.total + report.steps.total + report.features.total;
const completedItems = 
  (report.pages.total - report.pages.needsReview) +
  report.steps.files.filter(f => f.todos === 0).length +
  report.features.converted;

const progress = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;

console.log('\n' + '='.repeat(60));
console.log('  OVERALL PROGRESS: ' + progress + '%');
console.log('='.repeat(60));

// Save report
const reportPath = path.join(targetRoot, 'reports', 'migration-report.json');
const reportDir = path.dirname(reportPath);
if (!fs.existsSync(reportDir)) {
  fs.mkdirSync(reportDir, { recursive: true });
}
fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
console.log('\nDetailed report saved: ' + reportPath);
