#!/usr/bin/env node
/**
 * Script 03: Generate Page Class Skeletons
 * - Scans Java page classes from source
 * - Extracts locators and methods
 * - Generates TypeScript page class skeletons
 * - Converts XPath to Playwright locators (best effort)
 * 
 * Usage: node scripts/03-generate-pages.js <config-path>
 * Example: node scripts/03-generate-pages.js ./migration-config.json
 */

const fs = require('fs');
const path = require('path');

// Get config path from arguments
const configPath = process.argv[2] || './migration-config.json';

console.log('='.repeat(60));
console.log('  SCRIPT 03: PAGE CLASS GENERATION');
console.log('='.repeat(60));

// Load configuration
if (!fs.existsSync(configPath)) {
  console.log('\n[ERROR] Configuration file not found: ' + configPath);
  console.log('\nUsage: node scripts/03-generate-pages.js <config-path>');
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
const sourcePagesPath = config.source.pages?.path || 'src/pages';
const targetPagesPath = config.target.pages || 'src/pages';

const sourceDir = path.join(sourceRoot, sourcePagesPath);
const targetDir = path.join(targetRoot, targetPagesPath);

console.log('\n[INFO] Configuration loaded');
console.log('  Source pages: ' + sourceDir);
console.log('  Target pages: ' + targetDir);

// Validate source exists
if (!fs.existsSync(sourceDir)) {
  console.log('\n[ERROR] Source pages directory not found: ' + sourceDir);
  console.log('  Please check source.pages.path in your configuration');
  process.exit(1);
}

let totalFiles = 0;
const generatedFiles = [];
const manualReviewNeeded = [];

// XPath to Playwright conversion
function convertXPathToPlaywright(xpath, fieldName) {
  const result = {
    locator: '',
    needsReview: false,
    originalXpath: xpath
  };
  
  // Clean xpath
  xpath = xpath.replace(/^xpath\s*=\s*/, '').trim();
  
  // Pattern: //tag[@id='x']
  const idMatch = xpath.match(/^\/\/(\w+)\[@id=['"]([\w-]+)['"]\]$/);
  if (idMatch) {
    result.locator = "page.locator('#" + idMatch[2] + "')";
    return result;
  }
  
  // Pattern: //button[text()='x']
  const buttonTextMatch = xpath.match(/^\/\/button\[(?:text\(\)|normalize-space\(\))\s*=\s*['"](.+?)['"]\]$/);
  if (buttonTextMatch) {
    result.locator = "page.getByRole('button', { name: '" + buttonTextMatch[1] + "' })";
    return result;
  }
  
  // Pattern: //button[contains(text(),'x')]
  const buttonContainsMatch = xpath.match(/^\/\/button\[contains\((?:text\(\)|\.),\s*['"](.+?)['"]\)\]$/);
  if (buttonContainsMatch) {
    result.locator = "page.getByRole('button', { name: /" + buttonContainsMatch[1] + "/i })";
    return result;
  }
  
  // Pattern: //a[text()='x']
  const linkTextMatch = xpath.match(/^\/\/a\[(?:text\(\)|normalize-space\(\))\s*=\s*['"](.+?)['"]\]$/);
  if (linkTextMatch) {
    result.locator = "page.getByRole('link', { name: '" + linkTextMatch[1] + "' })";
    return result;
  }
  
  // Pattern: //input[@placeholder='x']
  const placeholderMatch = xpath.match(/^\/\/input\[@placeholder=['"](.*?)['"]\]$/);
  if (placeholderMatch) {
    result.locator = "page.getByPlaceholder('" + placeholderMatch[1] + "')";
    return result;
  }
  
  // Pattern: //label[text()='x']/following-sibling::input
  const labelSiblingMatch = xpath.match(/^\/\/label\[(?:text\(\)|normalize-space\(\))\s*=\s*['"](.+?)['"]\]\/following-sibling::input/);
  if (labelSiblingMatch) {
    result.locator = "page.getByLabel('" + labelSiblingMatch[1] + "')";
    return result;
  }
  
  // Pattern: //tag[@data-testid='x']
  const testIdMatch = xpath.match(/^\/\/\w+\[@data-testid=['"]([\w-]+)['"]\]$/);
  if (testIdMatch) {
    result.locator = "page.getByTestId('" + testIdMatch[1] + "')";
    return result;
  }
  
  // Pattern: //tag[@class='x']
  const classMatch = xpath.match(/^\/\/(\w+)\[@class=['"]([\w\s-]+)['"]\]$/);
  if (classMatch) {
    const classes = classMatch[2].split(/\s+/).join('.');
    result.locator = "page.locator('" + classMatch[1] + "." + classes + "')";
    return result;
  }
  
  // Pattern: //tag[contains(@class,'x')]
  const classContainsMatch = xpath.match(/^\/\/(\w+)\[contains\(@class,\s*['"](.+?)['"]\)\]$/);
  if (classContainsMatch) {
    result.locator = "page.locator('" + classContainsMatch[1] + "[class*=\"" + classContainsMatch[2] + "\"]')";
    return result;
  }
  
  // Pattern: //select[@id='x'] or //select[@name='x']
  const selectMatch = xpath.match(/^\/\/select\[@(?:id|name)=['"]([\w-]+)['"]\]$/);
  if (selectMatch) {
    result.locator = "page.locator('#" + selectMatch[1] + "')";
    result.needsReview = true;
    return result;
  }
  
  // Pattern: //table[@id='x']
  const tableMatch = xpath.match(/^\/\/table\[@id=['"]([\w-]+)['"]\]$/);
  if (tableMatch) {
    result.locator = "page.locator('#" + tableMatch[1] + "')";
    return result;
  }
  
  // Complex XPath - needs manual review
  result.locator = "page.locator('/* TODO: Convert XPath: " + xpath.substring(0, 50) + "... */')";
  result.needsReview = true;
  
  return result;
}

// Parse Java page class
function parseJavaPageClass(content, fileName) {
  const result = {
    className: '',
    locators: [],
    methods: []
  };
  
  // Extract class name
  const classMatch = content.match(/public\s+class\s+(\w+)/);
  if (classMatch) {
    result.className = classMatch[1];
  }
  
  // Extract @FindBy annotations with XPath
  const findByXPathRegex = /@FindBy\s*\(\s*xpath\s*=\s*"(.+?)"\s*\)\s*(?:private|public|protected)?\s*(?:WebElement|QAFWebElement)\s+(\w+)/g;
  let match;
  while ((match = findByXPathRegex.exec(content)) !== null) {
    const conversion = convertXPathToPlaywright(match[1], match[2]);
    result.locators.push({
      name: match[2],
      xpath: match[1],
      playwright: conversion.locator,
      needsReview: conversion.needsReview
    });
  }
  
  // Extract @FindBy with id
  const findByIdRegex = /@FindBy\s*\(\s*id\s*=\s*"(.+?)"\s*\)\s*(?:private|public|protected)?\s*(?:WebElement|QAFWebElement)\s+(\w+)/g;
  while ((match = findByIdRegex.exec(content)) !== null) {
    result.locators.push({
      name: match[2],
      xpath: 'id=' + match[1],
      playwright: "page.locator('#" + match[1] + "')",
      needsReview: false
    });
  }
  
  // Extract @FindBy with css
  const findByCssRegex = /@FindBy\s*\(\s*css\s*=\s*"(.+?)"\s*\)\s*(?:private|public|protected)?\s*(?:WebElement|QAFWebElement)\s+(\w+)/g;
  while ((match = findByCssRegex.exec(content)) !== null) {
    result.locators.push({
      name: match[2],
      xpath: 'css=' + match[1],
      playwright: "page.locator('" + match[1] + "')",
      needsReview: false
    });
  }
  
  // Extract public methods
  const methodRegex = /public\s+(?:void|boolean|String|int|WebElement|List<\w+>|\w+)\s+(\w+)\s*\(([^)]*)\)/g;
  while ((match = methodRegex.exec(content)) !== null) {
    const methodName = match[1];
    const params = match[2];
    
    // Skip standard methods
    if (['toString', 'equals', 'hashCode', 'getClass', 'wait', 'notify', 'openPage', 'launchPage'].includes(methodName)) {
      continue;
    }
    if (methodName.match(/^(get|set|is)[A-Z]/) && params === '') {
      continue;
    }
    
    result.methods.push({
      name: methodName,
      params: params
    });
  }
  
  return result;
}

// Generate TypeScript page class
function generateTypeScriptPage(parsed, moduleName) {
  const className = parsed.className.replace(/Page$/, '') + 'Page';
  
  // Generate locator declarations
  const locatorDeclarations = parsed.locators.map(loc => {
    const comment = loc.needsReview ? '  // TODO: Review - ' + loc.xpath.substring(0, 60) + '\n' : '';
    return comment + '  readonly ' + loc.name + ': Locator;';
  }).join('\n');
  
  // Generate locator initializations
  const locatorInits = parsed.locators.map(loc => {
    return '    this.' + loc.name + ' = ' + loc.playwright.replace('page.', 'this.page.') + ';';
  }).join('\n');
  
  // Generate method stubs
  const methodStubs = parsed.methods.map(method => {
    const tsParams = method.params
      .split(',')
      .filter(p => p.trim())
      .map(p => {
        const parts = p.trim().split(/\s+/);
        const name = parts[parts.length - 1];
        return name + ': string';
      })
      .join(', ');
    
    return `
  async ${method.name}(${tsParams}): Promise<void> {
    // TODO: Implement this method
    throw new Error('Not implemented');
  }`;
  }).join('\n');
  
  const reviewCount = parsed.locators.filter(l => l.needsReview).length;
  const reviewNote = reviewCount > 0 
    ? '\n// NOTE: ' + reviewCount + ' locator(s) need manual review - search for "TODO: Review"\n'
    : '';
  
  return `/**
 * Page: ${className}
 * Converted from: ${parsed.className}.java
 * Module: ${moduleName}
 */${reviewNote}
import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from '../base.page';

export class ${className} extends BasePage {
  // Locators
${locatorDeclarations || '  // No locators found'}

  constructor(page: Page) {
    super(page);
${locatorInits || '    // No locators to initialize'}
  }

  // Navigation
  async navigate(): Promise<void> {
    await this.page.goto('/${moduleName}');
    await this.page.waitForLoadState('networkidle');
  }

  // Methods
${methodStubs || '  // No methods to convert'}
}
`;
}

// Convert filename to kebab-case
function toKebabCase(str) {
  return str
    .replace(/Page\.java$/, '')
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
    } else if (item.endsWith('Page.java')) {
      try {
        const content = fs.readFileSync(srcItemPath, 'utf8');
        const parsed = parseJavaPageClass(content, item);
        
        if (parsed.className) {
          const tsContent = generateTypeScriptPage(parsed, moduleName);
          const tsFileName = toKebabCase(item) + '.page.ts';
          const tgtFilePath = path.join(tgtPath, tsFileName);
          
          fs.writeFileSync(tgtFilePath, tsContent);
          totalFiles++;
          
          const needsReview = parsed.locators.filter(l => l.needsReview);
          if (needsReview.length > 0) {
            manualReviewNeeded.push({
              file: tgtFilePath,
              count: needsReview.length
            });
          }
          
          generatedFiles.push({
            source: srcItemPath,
            target: tgtFilePath,
            locators: parsed.locators.length,
            methods: parsed.methods.length,
            needsReview: needsReview.length
          });
          
          if (needsReview.length > 0) {
            console.log('  [GENERATED] ' + tsFileName + ' (' + needsReview.length + ' locators need review)');
          } else {
            console.log('  [GENERATED] ' + tsFileName);
          }
        }
      } catch (err) {
        console.log('  [ERROR] ' + item + ' - ' + err.message);
      }
    }
  });
}

console.log('\n[INFO] Processing Java page classes...\n');
processDirectory(sourceDir, targetDir);

// Summary
console.log('\n' + '='.repeat(60));
console.log('  GENERATION COMPLETE');
console.log('='.repeat(60));
console.log('\nSummary:');
console.log('  Page classes generated: ' + totalFiles);
console.log('  Files needing review: ' + manualReviewNeeded.length);

if (manualReviewNeeded.length > 0) {
  console.log('\nFiles with XPath needing manual conversion:');
  manualReviewNeeded.forEach(item => {
    console.log('  - ' + item.file + ' (' + item.count + ' locators)');
  });
}

// Write report
const report = {
  timestamp: new Date().toISOString(),
  sourceDirectory: sourceDir,
  targetDirectory: targetDir,
  totalFiles: totalFiles,
  files: generatedFiles,
  needsManualReview: manualReviewNeeded
};

const reportPath = path.join(targetRoot, 'reports', 'page-generation-report.json');
const reportDir = path.dirname(reportPath);
if (!fs.existsSync(reportDir)) {
  fs.mkdirSync(reportDir, { recursive: true });
}
fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
console.log('\nReport saved: ' + reportPath);

console.log('\nNext steps:');
console.log('  1. Review files marked with "TODO: Review"');
console.log('  2. Use GitHub Copilot to help convert complex XPath');
console.log('  3. Run: node scripts/04-generate-steps.js ' + configPath);
