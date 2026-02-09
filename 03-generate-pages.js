#!/usr/bin/env node
/**
 * Script 03: Generate Page Class Skeletons
 * - Scans Java page classes from source (QAF style)
 * - Extracts locators from By.xpath(xpathExpression: "...") pattern
 * - Converts XPath to Playwright locators where possible
 * - Falls back to page.locator(xpath) for complex XPath
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
  const cleanContent = content.replace(/\/\/.*$/gm, '').replace(/,\s*}/g, '}').replace(/,\s*]/g, ']');
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
const conversionStats = {
  semantic: 0,    // Converted to getByRole, getByLabel, etc.
  css: 0,         // Converted to CSS selector
  xpath: 0        // Kept as XPath using page.locator
};

/**
 * Convert XPath to Playwright locator
 * Returns: { locator: string, type: 'semantic'|'css'|'xpath', comment?: string }
 */
function convertXPathToPlaywright(xpath, fieldName) {
  // Clean the xpath - remove quotes and whitespace
  xpath = xpath.trim().replace(/^["']|["']$/g, '');
  
  const result = {
    locator: '',
    type: 'xpath',
    originalXpath: xpath,
    comment: null
  };
  
  // Pattern: //button[text()='x'] or //button[normalize-space()='x'] or //button[.='x']
  const buttonTextExact = xpath.match(/^\/\/button\[(?:text\(\)|normalize-space\(\)|\.)\s*=\s*['"](.+?)['"]\]$/);
  if (buttonTextExact) {
    result.locator = `page.getByRole('button', { name: '${buttonTextExact[1]}' })`;
    result.type = 'semantic';
    return result;
  }
  
  // Pattern: //button[contains(text(),'x')] or //button[contains(.,'x')]
  const buttonTextContains = xpath.match(/^\/\/button\[contains\((?:text\(\)|\.),\s*['"](.+?)['"]\)\]$/);
  if (buttonTextContains) {
    result.locator = `page.getByRole('button', { name: /${buttonTextContains[1]}/i })`;
    result.type = 'semantic';
    return result;
  }
  
  // Pattern: //a[text()='x'] or //a[normalize-space()='x']
  const linkTextExact = xpath.match(/^\/\/a\[(?:text\(\)|normalize-space\(\)|\.)\s*=\s*['"](.+?)['"]\]$/);
  if (linkTextExact) {
    result.locator = `page.getByRole('link', { name: '${linkTextExact[1]}' })`;
    result.type = 'semantic';
    return result;
  }
  
  // Pattern: //a[contains(text(),'x')]
  const linkTextContains = xpath.match(/^\/\/a\[contains\((?:text\(\)|\.),\s*['"](.+?)['"]\)\]$/);
  if (linkTextContains) {
    result.locator = `page.getByRole('link', { name: /${linkTextContains[1]}/i })`;
    result.type = 'semantic';
    return result;
  }
  
  // Pattern: //input[@id='x']
  const inputById = xpath.match(/^\/\/input\[@id\s*=\s*['"](.+?)['"]\]$/);
  if (inputById) {
    result.locator = `page.locator('#${inputById[1]}')`;
    result.type = 'css';
    return result;
  }
  
  // Pattern: //input[@placeholder='x']
  const inputByPlaceholder = xpath.match(/^\/\/input\[@placeholder\s*=\s*['"](.+?)['"]\]$/);
  if (inputByPlaceholder) {
    result.locator = `page.getByPlaceholder('${inputByPlaceholder[1]}')`;
    result.type = 'semantic';
    return result;
  }
  
  // Pattern: //tag[@id='x']
  const anyById = xpath.match(/^\/\/(\w+)\[@id\s*=\s*['"](.+?)['"]\]$/);
  if (anyById) {
    result.locator = `page.locator('#${anyById[2]}')`;
    result.type = 'css';
    return result;
  }
  
  // Pattern: //tag[@data-testid='x']
  const byTestId = xpath.match(/^\/\/\w+\[@data-testid\s*=\s*['"](.+?)['"]\]$/);
  if (byTestId) {
    result.locator = `page.getByTestId('${byTestId[1]}')`;
    result.type = 'semantic';
    return result;
  }
  
  // Pattern: //tag[@class='x'] (exact match)
  const byClassExact = xpath.match(/^\/\/(\w+)\[@class\s*=\s*['"](.+?)['"]\]$/);
  if (byClassExact) {
    const classes = byClassExact[2].trim().split(/\s+/).join('.');
    result.locator = `page.locator('${byClassExact[1]}.${classes}')`;
    result.type = 'css';
    return result;
  }
  
  // Pattern: //tag[contains(@class,'x')]
  const byClassContains = xpath.match(/^\/\/(\w+)\[contains\(@class,\s*['"](.+?)['"]\)\]$/);
  if (byClassContains) {
    result.locator = `page.locator('${byClassContains[1]}[class*="${byClassContains[2]}"]')`;
    result.type = 'css';
    return result;
  }
  
  // Pattern: //*[text()='x'] or //*[.='x']
  const anyTextExact = xpath.match(/^\/\/\*\[(?:text\(\)|\.)\s*=\s*['"](.+?)['"]\]$/);
  if (anyTextExact) {
    result.locator = `page.getByText('${anyTextExact[1]}', { exact: true })`;
    result.type = 'semantic';
    return result;
  }
  
  // Pattern: //*[contains(text(),'x')]
  const anyTextContains = xpath.match(/^\/\/\*\[contains\((?:text\(\)|\.),\s*['"](.+?)['"]\)\]$/);
  if (anyTextContains) {
    result.locator = `page.getByText('${anyTextContains[1]}')`;
    result.type = 'semantic';
    return result;
  }
  
  // Pattern: //span[text()='x'] or //div[text()='x'] etc.
  const elementTextExact = xpath.match(/^\/\/(\w+)\[(?:text\(\)|\.)\s*=\s*['"](.+?)['"]\]$/);
  if (elementTextExact) {
    result.locator = `page.locator('${elementTextExact[1]}').filter({ hasText: '${elementTextExact[2]}' })`;
    result.type = 'css';
    return result;
  }
  
  // Pattern: //span[contains(text(),'x')]
  const elementTextContains = xpath.match(/^\/\/(\w+)\[contains\((?:text\(\)|\.),\s*['"](.+?)['"]\)\]$/);
  if (elementTextContains) {
    result.locator = `page.locator('${elementTextContains[1]}').filter({ hasText: /${elementTextContains[2]}/i })`;
    result.type = 'css';
    return result;
  }
  
  // Pattern: //select[@id='x'] or //select[@name='x']
  const selectMatch = xpath.match(/^\/\/select\[@(?:id|name)\s*=\s*['"](.+?)['"]\]$/);
  if (selectMatch) {
    result.locator = `page.locator('select#${selectMatch[1]}')`;
    result.type = 'css';
    return result;
  }
  
  // Pattern: //th[@aria-colindex='x']//a
  const thAriaColIndex = xpath.match(/^\/\/th\[@aria-colindex\s*=\s*['"](\d+)['"]\]\/\/a$/);
  if (thAriaColIndex) {
    result.locator = `page.locator('th[aria-colindex="${thAriaColIndex[1]}"] a')`;
    result.type = 'css';
    return result;
  }
  
  // Pattern: //table//tr[x]/td[y] - table cell access
  const tableCellMatch = xpath.match(/^\/\/table(?:\/\/|\/)tr\[(\d+)\]\/td\[(\d+)\]/);
  if (tableCellMatch) {
    result.locator = `page.locator('table tr:nth-child(${tableCellMatch[1]}) td:nth-child(${tableCellMatch[2]})')`;
    result.type = 'css';
    return result;
  }
  
  // FALLBACK: Use page.locator with xpath
  // Escape any backticks in xpath for template literal
  const escapedXpath = xpath.replace(/`/g, '\\`').replace(/\$/g, '\\$');
  result.locator = `page.locator(\`${escapedXpath}\`)`;
  result.type = 'xpath';
  result.comment = `XPath preserved - consider manual review`;
  
  return result;
}

/**
 * Parse Java page class for QAF-style locators
 * Handles: By.xpath(xpathExpression: "...")
 */
function parseJavaPageClass(content, fileName) {
  const result = {
    className: '',
    locators: [],
    methods: []
  };
  
  // Extract class name
  const classMatch = content.match(/(?:public\s+)?class\s+(\w+)(?:\s+extends\s+\w+)?/);
  if (classMatch) {
    result.className = classMatch[1];
  }
  
  // Pattern 1: QAF style - public static final By fieldName = By.xpath(xpathExpression: "...");
  // Matches: public static final By trade = By.xpath(xpathExpression: "//button[contains(text(),'Trade')]");
  // Need to handle nested quotes - use a more robust regex
  const qafXpathRegex = /(?:public\s+)?static\s+final\s+By\s+(\w+)\s*=\s*By\.xpath\s*\(\s*xpathExpression\s*:\s*"([^"]+)"\s*\)/g;
  let match;
  
  while ((match = qafXpathRegex.exec(content)) !== null) {
    const fieldName = match[1];
    const xpath = match[2];
    const conversion = convertXPathToPlaywright(xpath, fieldName);
    
    result.locators.push({
      name: fieldName,
      xpath: xpath,
      playwright: conversion.locator,
      type: conversion.type,
      comment: conversion.comment
    });
    
    // Update stats
    conversionStats[conversion.type]++;
  }
  
  // Pattern 1b: QAF style with single quotes
  const qafXpathRegex2 = /(?:public\s+)?static\s+final\s+By\s+(\w+)\s*=\s*By\.xpath\s*\(\s*xpathExpression\s*:\s*'([^']+)'\s*\)/g;
  while ((match = qafXpathRegex2.exec(content)) !== null) {
    const exists = result.locators.some(l => l.name === match[1]);
    if (!exists) {
      const fieldName = match[1];
      const xpath = match[2];
      const conversion = convertXPathToPlaywright(xpath, fieldName);
      
      result.locators.push({
        name: fieldName,
        xpath: xpath,
        playwright: conversion.locator,
        type: conversion.type,
        comment: conversion.comment
      });
      
      conversionStats[conversion.type]++;
    }
  }
  
  // Pattern 2: Simple By.xpath - By.xpath("...")
  const simpleXpathRegex = /(?:public\s+)?static\s+final\s+By\s+(\w+)\s*=\s*By\.xpath\s*\(\s*["'](.+?)["']\s*\)/g;
  while ((match = simpleXpathRegex.exec(content)) !== null) {
    // Skip if already captured by QAF pattern
    const exists = result.locators.some(l => l.name === match[1]);
    if (!exists) {
      const fieldName = match[1];
      const xpath = match[2];
      const conversion = convertXPathToPlaywright(xpath, fieldName);
      
      result.locators.push({
        name: fieldName,
        xpath: xpath,
        playwright: conversion.locator,
        type: conversion.type,
        comment: conversion.comment
      });
      
      conversionStats[conversion.type]++;
    }
  }
  
  // Pattern 3: @FindBy annotations with xpath
  const findByXPathRegex = /@FindBy\s*\(\s*xpath\s*=\s*["'](.+?)["']\s*\)\s*(?:private|public|protected)?\s*(?:WebElement|QAFWebElement)\s+(\w+)/g;
  while ((match = findByXPathRegex.exec(content)) !== null) {
    const xpath = match[1];
    const fieldName = match[2];
    const conversion = convertXPathToPlaywright(xpath, fieldName);
    
    result.locators.push({
      name: fieldName,
      xpath: xpath,
      playwright: conversion.locator,
      type: conversion.type,
      comment: conversion.comment
    });
    
    conversionStats[conversion.type]++;
  }
  
  // Pattern 4: @FindBy with id
  const findByIdRegex = /@FindBy\s*\(\s*id\s*=\s*["'](.+?)["']\s*\)\s*(?:private|public|protected)?\s*(?:WebElement|QAFWebElement)\s+(\w+)/g;
  while ((match = findByIdRegex.exec(content)) !== null) {
    result.locators.push({
      name: match[2],
      xpath: 'id=' + match[1],
      playwright: `page.locator('#${match[1]}')`,
      type: 'css'
    });
    conversionStats.css++;
  }
  
  // Pattern 5: @FindBy with css
  const findByCssRegex = /@FindBy\s*\(\s*css\s*=\s*["'](.+?)["']\s*\)\s*(?:private|public|protected)?\s*(?:WebElement|QAFWebElement)\s+(\w+)/g;
  while ((match = findByCssRegex.exec(content)) !== null) {
    result.locators.push({
      name: match[2],
      xpath: 'css=' + match[1],
      playwright: `page.locator('${match[1]}')`,
      type: 'css'
    });
    conversionStats.css++;
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

/**
 * Generate TypeScript page class
 */
function generateTypeScriptPage(parsed, moduleName) {
  const className = parsed.className.replace(/Page$/, '') + 'Page';
  
  // Group locators by type for commenting
  const semanticLocators = parsed.locators.filter(l => l.type === 'semantic');
  const cssLocators = parsed.locators.filter(l => l.type === 'css');
  const xpathLocators = parsed.locators.filter(l => l.type === 'xpath');
  
  // Generate locator declarations
  let locatorDeclarations = '';
  
  if (semanticLocators.length > 0) {
    locatorDeclarations += '  // Semantic locators (getByRole, getByLabel, etc.)\n';
    semanticLocators.forEach(loc => {
      locatorDeclarations += `  readonly ${loc.name}: Locator;\n`;
    });
    locatorDeclarations += '\n';
  }
  
  if (cssLocators.length > 0) {
    locatorDeclarations += '  // CSS locators\n';
    cssLocators.forEach(loc => {
      locatorDeclarations += `  readonly ${loc.name}: Locator;\n`;
    });
    locatorDeclarations += '\n';
  }
  
  if (xpathLocators.length > 0) {
    locatorDeclarations += '  // XPath locators (consider refactoring to semantic locators)\n';
    xpathLocators.forEach(loc => {
      locatorDeclarations += `  readonly ${loc.name}: Locator;\n`;
    });
  }
  
  // Generate locator initializations
  let locatorInits = '';
  parsed.locators.forEach(loc => {
    const playwrightLocator = loc.playwright.replace('page.', 'this.page.');
    if (loc.comment) {
      locatorInits += `    // ${loc.comment}\n`;
      locatorInits += `    // Original: ${loc.xpath.substring(0, 80)}${loc.xpath.length > 80 ? '...' : ''}\n`;
    }
    locatorInits += `    this.${loc.name} = ${playwrightLocator};\n`;
  });
  
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
  
  // Summary comment
  const summaryComment = `
/**
 * Page: ${className}
 * Converted from: ${parsed.className}.java
 * Module: ${moduleName}
 * 
 * Locator conversion summary:
 *   - Semantic (getByRole, etc.): ${semanticLocators.length}
 *   - CSS selectors: ${cssLocators.length}
 *   - XPath preserved: ${xpathLocators.length}
 */`;
  
  return `${summaryComment}
import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from '../base.page';

export class ${className} extends BasePage {
  // Locators
${locatorDeclarations || '  // No locators found\n'}
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
    } else if (item.endsWith('Page.java') || item.endsWith('page.java')) {
      try {
        const content = fs.readFileSync(srcItemPath, 'utf8');
        const parsed = parseJavaPageClass(content, item);
        
        if (parsed.className) {
          const tsContent = generateTypeScriptPage(parsed, moduleName);
          const tsFileName = toKebabCase(item) + '.page.ts';
          const tgtFilePath = path.join(tgtPath, tsFileName);
          
          fs.writeFileSync(tgtFilePath, tsContent);
          totalFiles++;
          
          const xpathCount = parsed.locators.filter(l => l.type === 'xpath').length;
          
          generatedFiles.push({
            source: srcItemPath,
            target: tgtFilePath,
            locators: parsed.locators.length,
            methods: parsed.methods.length,
            semantic: parsed.locators.filter(l => l.type === 'semantic').length,
            css: parsed.locators.filter(l => l.type === 'css').length,
            xpath: xpathCount
          });
          
          let statusMsg = tsFileName + ' (' + parsed.locators.length + ' locators';
          if (xpathCount > 0) {
            statusMsg += ', ' + xpathCount + ' XPath preserved';
          }
          statusMsg += ')';
          console.log('  [GENERATED] ' + statusMsg);
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
console.log('\nLocator conversion breakdown:');
console.log('  - Semantic (getByRole, getByLabel, etc.): ' + conversionStats.semantic);
console.log('  - CSS selectors: ' + conversionStats.css);
console.log('  - XPath preserved (page.locator): ' + conversionStats.xpath);

if (conversionStats.xpath > 0) {
  console.log('\n[NOTE] ' + conversionStats.xpath + ' XPath locators were preserved using page.locator()');
  console.log('       Consider refactoring these to semantic locators for better reliability.');
}

// Write report
const report = {
  timestamp: new Date().toISOString(),
  sourceDirectory: sourceDir,
  targetDirectory: targetDir,
  totalFiles: totalFiles,
  conversionStats: conversionStats,
  files: generatedFiles
};

const reportPath = path.join(targetRoot, 'reports', 'page-generation-report.json');
const reportDir = path.dirname(reportPath);
if (!fs.existsSync(reportDir)) {
  fs.mkdirSync(reportDir, { recursive: true });
}
fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
console.log('\nReport saved: ' + reportPath);

console.log('\nNext steps:');
console.log('  1. Review XPath locators and refactor where possible');
console.log('  2. Use GitHub Copilot to help convert complex XPath');
console.log('  3. Run: node scripts/04-generate-steps.js ' + configPath);
