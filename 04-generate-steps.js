#!/usr/bin/env node
/**
 * Script 04: Generate Step Definition Skeletons
 * - Scans Java step definition files from source
 * - Extracts step annotations
 * - Generates TypeScript step definition skeletons
 * 
 * Usage: node scripts/04-generate-steps.js <config-path>
 * Example: node scripts/04-generate-steps.js ./migration-config.json
 */

const fs = require('fs');
const path = require('path');

// Get config path from arguments
const configPath = process.argv[2] || './migration-config.json';

console.log('='.repeat(60));
console.log('  SCRIPT 04: STEP DEFINITION GENERATION');
console.log('='.repeat(60));

// Load configuration
if (!fs.existsSync(configPath)) {
  console.log('\n[ERROR] Configuration file not found: ' + configPath);
  console.log('\nUsage: node scripts/04-generate-steps.js <config-path>');
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
const sourceStepsPath = config.source.steps?.path || 'src/steps';
const targetStepsPath = config.target.steps || 'src/steps';

const sourceDir = path.join(sourceRoot, sourceStepsPath);
const targetDir = path.join(targetRoot, targetStepsPath);

console.log('\n[INFO] Configuration loaded');
console.log('  Source steps: ' + sourceDir);
console.log('  Target steps: ' + targetDir);

// Validate source exists
if (!fs.existsSync(sourceDir)) {
  console.log('\n[ERROR] Source steps directory not found: ' + sourceDir);
  console.log('  Please check source.steps.path in your configuration');
  process.exit(1);
}

let totalFiles = 0;
let totalSteps = 0;
const generatedFiles = [];
const allPageFixtures = new Set();

// Convert step description to playwright-bdd format
function convertStepDescription(desc) {
  return desc
    .replace(/\{(\d+)\}/g, '{string}')
    .replace(/\{word\}/g, '{string}')
    .replace(/\{int\}/g, '{int}');
}

// Parse Java parameters
function parseJavaParams(params) {
  if (!params.trim()) return [];
  
  return params.split(',').map(param => {
    const parts = param.trim().split(/\s+/);
    const type = parts[0];
    const name = parts[parts.length - 1];
    
    let tsType = 'string';
    if (type === 'int' || type === 'Integer' || type === 'long' || type === 'Long') {
      tsType = 'number';
    } else if (type === 'boolean' || type === 'Boolean') {
      tsType = 'boolean';
    }
    
    return { name, type: tsType };
  });
}

// Infer step type from description
function inferStepType(description) {
  const lowerDesc = description.toLowerCase();
  
  if (lowerDesc.startsWith('user is') || 
      lowerDesc.startsWith('user has') || 
      lowerDesc.startsWith('given') ||
      lowerDesc.includes('is on') ||
      lowerDesc.includes('exists') ||
      lowerDesc.includes('logged in')) {
    return 'Given';
  }
  
  if (lowerDesc.startsWith('user should') || 
      lowerDesc.startsWith('then') ||
      lowerDesc.startsWith('verify') ||
      lowerDesc.includes('should see') ||
      lowerDesc.includes('should be') ||
      lowerDesc.includes('should not') ||
      lowerDesc.includes('is displayed') ||
      lowerDesc.includes('is visible')) {
    return 'Then';
  }
  
  return 'When';
}

// Infer page fixture from class name
function inferPageFixture(className) {
  let pageName = className.replace(/Steps?$/, '');
  
  const mapping = {
    'Account': 'accountsPage',
    'Accounts': 'accountsPage',
    'Login': 'loginPage',
    'Admin': 'adminPage',
    'Order': 'ordersPage',
    'Orders': 'ordersPage',
    'Security': 'securitiesPage',
    'Securities': 'securitiesPage',
    'Transaction': 'transactionsPage',
    'Transactions': 'transactionsPage',
    'Dashboard': 'dashboardPage',
  };
  
  for (const [key, value] of Object.entries(mapping)) {
    if (pageName.includes(key)) {
      return value;
    }
  }
  
  return pageName.charAt(0).toLowerCase() + pageName.slice(1) + 'Page';
}

// Parse Java step definition file
function parseJavaStepsFile(content, fileName) {
  const result = {
    className: '',
    steps: [],
    pageFixtures: new Set()
  };
  
  // Extract class name
  const classMatch = content.match(/public\s+class\s+(\w+)/);
  if (classMatch) {
    result.className = classMatch[1];
  }
  
  // Extract @QAFTestStep annotations
  const qafStepRegex = /@QAFTestStep\s*\(\s*description\s*=\s*"(.+?)"\s*\)\s*public\s+(?:void|boolean|String|\w+)\s+(\w+)\s*\(([^)]*)\)/g;
  let match;
  
  while ((match = qafStepRegex.exec(content)) !== null) {
    const description = match[1];
    const methodName = match[2];
    const params = match[3];
    
    const stepType = inferStepType(description);
    const convertedDesc = convertStepDescription(description);
    const parsedParams = parseJavaParams(params);
    const pageFixture = inferPageFixture(result.className);
    
    result.pageFixtures.add(pageFixture);
    
    result.steps.push({
      description: convertedDesc,
      originalDescription: description,
      methodName: methodName,
      stepType: stepType,
      params: parsedParams,
      pageFixture: pageFixture
    });
  }
  
  // Extract Cucumber-style annotations
  const cucumberRegex = /@(Given|When|Then)\s*\(\s*"(.+?)"\s*\)\s*public\s+(?:void|boolean|String|\w+)\s+(\w+)\s*\(([^)]*)\)/g;
  while ((match = cucumberRegex.exec(content)) !== null) {
    const stepType = match[1];
    const description = match[2];
    const methodName = match[3];
    const params = match[4];
    
    const convertedDesc = convertStepDescription(description);
    const parsedParams = parseJavaParams(params);
    const pageFixture = inferPageFixture(result.className);
    
    result.pageFixtures.add(pageFixture);
    
    result.steps.push({
      description: convertedDesc,
      originalDescription: description,
      methodName: methodName,
      stepType: stepType,
      params: parsedParams,
      pageFixture: pageFixture
    });
  }
  
  return result;
}

// Generate TypeScript step definitions
function generateTypeScriptSteps(parsed, moduleName) {
  const pageFixtures = Array.from(parsed.pageFixtures);
  
  const stepDefs = parsed.steps.map(step => {
    const fixtureParams = '{ ' + step.pageFixture + ' }';
    const stepParams = step.params.map(p => p.name + ': ' + p.type).join(', ');
    const allParams = stepParams ? fixtureParams + ', ' + stepParams : fixtureParams;
    
    return `
${step.stepType}('${step.description}', async (${allParams}) => {
  // TODO: Implement - Original method: ${step.methodName}
  throw new Error('Not implemented');
});`;
  }).join('\n');
  
  return `/**
 * Step Definitions: ${parsed.className}
 * Converted from: ${parsed.className}.java
 * Module: ${moduleName}
 * 
 * Page fixtures used: ${pageFixtures.join(', ')}
 */
import { Given, When, Then, expect } from '../fixtures';

// Step Definitions
${stepDefs || '// No steps found'}
`;
}

// Convert filename to kebab-case
function toKebabCase(str) {
  return str
    .replace(/Steps?\.java$/, '')
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1-$2')
    .toLowerCase();
}

// Process directory recursively
function processDirectory(srcPath, tgtPath, moduleName = '') {
  if (!fs.existsSync(srcPath)) {
    return;
  }
  
  const items = fs.readdirSync(srcPath);
  
  items.forEach(item => {
    const srcItemPath = path.join(srcPath, item);
    const stats = fs.statSync(srcItemPath);
    
    if (stats.isDirectory()) {
      const moduleDir = item.toLowerCase();
      const tgtModuleDir = path.join(tgtPath, moduleDir);
      
      if (!fs.existsSync(tgtModuleDir)) {
        fs.mkdirSync(tgtModuleDir, { recursive: true });
      }
      
      processDirectory(srcItemPath, tgtModuleDir, moduleDir);
    } else if (item.endsWith('Steps.java') || item.endsWith('Step.java')) {
      try {
        const content = fs.readFileSync(srcItemPath, 'utf8');
        const parsed = parseJavaStepsFile(content, item);
        
        if (parsed.steps.length > 0) {
          const tsContent = generateTypeScriptSteps(parsed, moduleName);
          const tsFileName = toKebabCase(item) + '.steps.ts';
          const tgtFilePath = path.join(tgtPath, tsFileName);
          
          fs.writeFileSync(tgtFilePath, tsContent);
          totalFiles++;
          totalSteps += parsed.steps.length;
          
          // Collect page fixtures
          parsed.pageFixtures.forEach(pf => allPageFixtures.add(pf));
          
          generatedFiles.push({
            source: srcItemPath,
            target: tgtFilePath,
            steps: parsed.steps.length,
            pageFixtures: Array.from(parsed.pageFixtures)
          });
          
          console.log('  [GENERATED] ' + tsFileName + ' (' + parsed.steps.length + ' steps)');
        }
      } catch (err) {
        console.log('  [ERROR] ' + item + ' - ' + err.message);
      }
    }
  });
}

console.log('\n[INFO] Processing Java step definitions...\n');
processDirectory(sourceDir, targetDir);

// Summary
console.log('\n' + '='.repeat(60));
console.log('  GENERATION COMPLETE');
console.log('='.repeat(60));
console.log('\nSummary:');
console.log('  Step files generated: ' + totalFiles);
console.log('  Total steps: ' + totalSteps);
console.log('\nPage fixtures needed in fixtures.ts:');
Array.from(allPageFixtures).sort().forEach(pf => {
  console.log('  - ' + pf);
});

// Write report
const report = {
  timestamp: new Date().toISOString(),
  sourceDirectory: sourceDir,
  targetDirectory: targetDir,
  totalFiles: totalFiles,
  totalSteps: totalSteps,
  files: generatedFiles,
  pageFixturesNeeded: Array.from(allPageFixtures)
};

const reportPath = path.join(targetRoot, 'reports', 'steps-generation-report.json');
const reportDir = path.dirname(reportPath);
if (!fs.existsSync(reportDir)) {
  fs.mkdirSync(reportDir, { recursive: true });
}
fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
console.log('\nReport saved: ' + reportPath);

console.log('\nNext steps:');
console.log('  1. Run: node scripts/05-generate-fixtures.js ' + configPath);
console.log('  2. Implement the TODO methods in step files');
console.log('  3. Use GitHub Copilot to help with implementations');
