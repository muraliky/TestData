#!/usr/bin/env node
/**
 * Script 01: Setup Playwright Project
 * Creates the project structure DYNAMICALLY based on source repository
 * 
 * Usage: node scripts/01-setup-project.js <config-path>
 * Example: node scripts/01-setup-project.js ./migration-config.json
 */

const fs = require('fs');
const path = require('path');

// Get config path from arguments
const configPath = process.argv[2] || './migration-config.json';

console.log('='.repeat(60));
console.log('  SCRIPT 01: PLAYWRIGHT PROJECT SETUP');
console.log('='.repeat(60));

// Load configuration
if (!fs.existsSync(configPath)) {
  console.log('\n[ERROR] Configuration file not found: ' + configPath);
  console.log('\nUsage: node scripts/01-setup-project.js <config-path>');
  console.log('Example: node scripts/01-setup-project.js ./migration-config.json');
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

const sourceRoot = config.source.rootDir;
const targetDir = config.target.rootDir;

console.log('\n[INFO] Configuration loaded successfully');
console.log('  Source repository: ' + sourceRoot);
console.log('  Target directory:  ' + targetDir);

// Validate source exists
if (!fs.existsSync(sourceRoot)) {
  console.log('\n[ERROR] Source repository not found: ' + sourceRoot);
  console.log('  Please update source.rootDir in your configuration file');
  process.exit(1);
}

// Function to convert folder names to kebab-case
function toKebabCase(str) {
  return str
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1-$2')
    .replace(/\s+/g, '-')
    .replace(/\.+/g, '-')
    .replace(/_+/g, '-')
    .replace(/--+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();
}

// Function to scan directory structure recursively
function scanDirectoryStructure(dirPath, basePath = '') {
  const structure = [];
  
  if (!fs.existsSync(dirPath)) {
    return structure;
  }
  
  try {
    const items = fs.readdirSync(dirPath);
    
    items.forEach(item => {
      const fullPath = path.join(dirPath, item);
      const relativePath = basePath ? basePath + '/' + item : item;
      
      if (fs.statSync(fullPath).isDirectory()) {
        structure.push(relativePath);
        structure.push(...scanDirectoryStructure(fullPath, relativePath));
      }
    });
  } catch (err) {
    console.log('  [WARNING] Could not scan directory: ' + dirPath);
  }
  
  return structure;
}

// Function to convert source folder structure to target structure
function convertFolderStructure(sourceFolders, folderMapping = {}) {
  return sourceFolders.map(folder => {
    const parts = folder.split(/[/\\]/);
    const convertedParts = parts.map(part => {
      if (folderMapping[part]) {
        return folderMapping[part];
      }
      return toKebabCase(part);
    });
    return convertedParts.join('/');
  });
}

// Get folder mapping from config
const folderMapping = config.options?.features?.folderMapping || {};

// Base directories
const baseDirectories = [
  'src/pages',
  'src/steps',
  'src/utils',
  'src/fixtures',
  'src/types',
  'features',
  'test-data',
  'config',
  'scripts',
  'screenshots',
  '.github'
];

// Scan source directories
let pagesDirs = [];
let stepsDirs = [];
let featuresDirs = [];
let envDirs = config.options?.project?.environments || ['dev'];

// Scan pages
if (config.source.pages?.path) {
  const pagesPath = path.join(sourceRoot, config.source.pages.path);
  console.log('\n[INFO] Scanning pages directory: ' + pagesPath);
  
  if (fs.existsSync(pagesPath)) {
    const sourcePagesStructure = scanDirectoryStructure(pagesPath);
    pagesDirs = convertFolderStructure(sourcePagesStructure, folderMapping);
    console.log('  Found ' + pagesDirs.length + ' subdirectories');
    pagesDirs.forEach(d => console.log('    - ' + d));
  } else {
    console.log('  [WARNING] Pages directory not found');
  }
}

// Scan steps
if (config.source.steps?.path) {
  const stepsPath = path.join(sourceRoot, config.source.steps.path);
  console.log('\n[INFO] Scanning steps directory: ' + stepsPath);
  
  if (fs.existsSync(stepsPath)) {
    const sourceStepsStructure = scanDirectoryStructure(stepsPath);
    stepsDirs = convertFolderStructure(sourceStepsStructure, folderMapping);
    console.log('  Found ' + stepsDirs.length + ' subdirectories');
    stepsDirs.forEach(d => console.log('    - ' + d));
  } else {
    console.log('  [WARNING] Steps directory not found');
  }
}

// Scan features
if (config.source.features?.path) {
  const featuresPath = path.join(sourceRoot, config.source.features.path);
  console.log('\n[INFO] Scanning features directory: ' + featuresPath);
  
  if (fs.existsSync(featuresPath)) {
    const sourceFeaturesStructure = scanDirectoryStructure(featuresPath);
    featuresDirs = convertFolderStructure(sourceFeaturesStructure, folderMapping);
    console.log('  Found ' + featuresDirs.length + ' subdirectories');
    featuresDirs.forEach(d => console.log('    - ' + d));
  } else {
    console.log('  [WARNING] Features directory not found');
  }
}

// Build complete directory list
const directories = [
  ...baseDirectories,
  ...pagesDirs.map(d => 'src/pages/' + d),
  ...stepsDirs.map(d => 'src/steps/' + d),
  ...featuresDirs.map(d => 'features/' + d),
  ...envDirs.map(d => 'test-data/' + d)
];

const uniqueDirectories = [...new Set(directories)].sort();

// File templates
const files = {
  'package.json': JSON.stringify({
    name: config.projectName || 'playwright-automation',
    version: '1.0.0',
    description: config.description || 'Playwright BDD Test Automation',
    scripts: {
      'test': 'npx bddgen && npx playwright test',
      'test:smoke': 'npx bddgen && npx playwright test --grep @smoke',
      'test:integration': 'npx bddgen && npx playwright test --grep @integration',
      'test:headed': 'npx bddgen && npx playwright test --headed',
      'test:debug': 'npx bddgen && npx playwright test --debug',
      'report': 'npx playwright show-report'
    },
    devDependencies: {
      '@playwright/test': '^1.40.0',
      'playwright-bdd': '^6.0.0',
      'typescript': '^5.0.0',
      'ts-node': '^10.9.0',
      '@types/node': '^20.0.0',
      'dotenv': '^16.0.0',
      'cross-env': '^7.0.3'
    }
  }, null, 2),

  'tsconfig.json': JSON.stringify({
    compilerOptions: {
      target: 'ES2022',
      module: 'commonjs',
      moduleResolution: 'node',
      strict: true,
      esModuleInterop: true,
      skipLibCheck: true,
      forceConsistentCasingInFileNames: true,
      outDir: './dist',
      rootDir: './',
      resolveJsonModule: true,
      baseUrl: '.',
      paths: {
        '@pages/*': ['src/pages/*'],
        '@steps/*': ['src/steps/*'],
        '@utils/*': ['src/utils/*']
      }
    },
    include: ['src/**/*', 'features/**/*', 'playwright.config.ts'],
    exclude: ['node_modules', 'dist']
  }, null, 2),

  'playwright.config.ts': `import { defineConfig, devices } from '@playwright/test';
import { defineBddConfig } from 'playwright-bdd';
import dotenv from 'dotenv';

const env = process.env.ENV || '${config.options?.project?.defaultEnv || 'dev'}';
dotenv.config({ path: \`.env.\${env}\` });

const testDir = defineBddConfig({
  features: 'features/**/*.feature',
  steps: 'src/steps/**/*.steps.ts',
});

export default defineConfig({
  testDir,
  fullyParallel: true,
  workers: process.env.CI ? 2 : 4,
  retries: process.env.CI ? 2 : 0,
  reporter: [['html', { open: 'never' }], ['list']],
  timeout: 60000,
  expect: { timeout: 10000 },

  use: {
    baseURL: process.env.BASE_URL || '${config.options?.project?.baseUrl || 'https://example.com'}',
    headless: process.env.HEADLESS !== 'false',
    viewport: { width: 1920, height: 1080 },
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    trace: 'retain-on-failure',
  },

  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
  ],
});`,

  '.gitignore': `node_modules/
dist/
test-results/
playwright-report/
playwright/.cache/
screenshots/
.env.*
!.env.example
auth/
*.log`,

  'src/pages/base.page.ts': `import { Page, Locator, expect } from '@playwright/test';

export abstract class BasePage {
  constructor(readonly page: Page) {}

  async navigate(path: string = ''): Promise<void> {
    await this.page.goto(path);
    await this.page.waitForLoadState('networkidle');
  }

  async waitForElement(locator: Locator, timeout = 10000): Promise<void> {
    await locator.waitFor({ state: 'visible', timeout });
  }

  async waitForElementToDisappear(locator: Locator, timeout = 10000): Promise<void> {
    await locator.waitFor({ state: 'hidden', timeout });
  }

  async click(locator: Locator): Promise<void> {
    await locator.click();
  }

  async fill(locator: Locator, value: string): Promise<void> {
    await locator.fill(value);
  }

  async getText(locator: Locator): Promise<string> {
    return await locator.innerText();
  }

  async isVisible(locator: Locator): Promise<boolean> {
    return await locator.isVisible();
  }

  getTableRowByText(tableLocator: Locator, text: string): Locator {
    return tableLocator.locator('tbody tr').filter({ hasText: text });
  }

  async expectVisible(locator: Locator): Promise<void> {
    await expect(locator).toBeVisible();
  }

  async expectText(locator: Locator, text: string): Promise<void> {
    await expect(locator).toHaveText(text);
  }

  async expectContainsText(locator: Locator, text: string): Promise<void> {
    await expect(locator).toContainText(text);
  }
}`,

  'src/steps/common.steps.ts': `import { Given, When, Then, expect } from './fixtures';

Then('the page title should be {string}', async ({ page }, title: string) => {
  await expect(page).toHaveTitle(title);
});

Then('the page URL should contain {string}', async ({ page }, urlPart: string) => {
  await expect(page).toHaveURL(new RegExp(urlPart));
});

Then('user should see text {string}', async ({ page }, text: string) => {
  await expect(page.getByText(text)).toBeVisible();
});

When('user clicks on button {string}', async ({ page }, buttonText: string) => {
  await page.getByRole('button', { name: buttonText }).click();
});

When('user clicks on link {string}', async ({ page }, linkText: string) => {
  await page.getByRole('link', { name: linkText }).click();
});

When('user enters {string} in field {string}', async ({ page }, value: string, fieldLabel: string) => {
  await page.getByLabel(fieldLabel).fill(value);
});

When('user waits for {int} seconds', async ({ page }, seconds: number) => {
  await page.waitForTimeout(seconds * 1000);
});

When('user waits for page to load', async ({ page }) => {
  await page.waitForLoadState('networkidle');
});
`,

  'src/utils/data.utils.ts': `import * as fs from 'fs';
import * as path from 'path';

export class DataUtils {
  static loadJson<T>(filePath: string): T {
    const fullPath = path.resolve(filePath);
    return JSON.parse(fs.readFileSync(fullPath, 'utf-8'));
  }

  static getEnvData<T>(category: string): T {
    const env = process.env.ENV || 'dev';
    return this.loadJson<T>(\`test-data/\${env}/\${category}.json\`);
  }

  static randomString(length: number = 8): string {
    return Math.random().toString(36).substring(2, 2 + length);
  }

  static randomEmail(domain: string = 'test.com'): string {
    return \`test.\${this.randomString()}@\${domain}\`;
  }
}`,

  '.github/copilot-instructions.md': `# Copilot Instructions for Playwright Migration

## XPath Conversion Rules
NEVER use XPath. Convert using this priority:
1. getByRole() - buttons, links, inputs
2. getByLabel() - form inputs with labels  
3. getByPlaceholder() - inputs with placeholder
4. getByText() - unique text elements
5. getByTestId() - data-testid attributes
6. CSS Selectors - when above don't work

## Feature File Rules
playwright-bdd does NOT support And/But keywords.
Convert And/But to Given/When/Then based on context.
`
};

// Generate environment files
envDirs.forEach(env => {
  files['.env.' + env] = `ENV=${env}
BASE_URL=${config.options?.project?.baseUrl || 'https://example.com'}
HEADLESS=true`;
});

// Create directories
console.log('\n[INFO] Creating directories...');
let dirCount = 0;
uniqueDirectories.forEach(dir => {
  const fullPath = path.join(targetDir, dir);
  if (!fs.existsSync(fullPath)) {
    fs.mkdirSync(fullPath, { recursive: true });
    dirCount++;
  }
});
console.log('  Created ' + dirCount + ' directories');

// Create files
console.log('\n[INFO] Creating files...');
let fileCount = 0;
Object.entries(files).forEach(([filePath, content]) => {
  const fullPath = path.join(targetDir, filePath);
  const dir = path.dirname(fullPath);
  
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  
  fs.writeFileSync(fullPath, content);
  fileCount++;
});
console.log('  Created ' + fileCount + ' files');

// Summary
console.log('\n' + '='.repeat(60));
console.log('  SETUP COMPLETE');
console.log('='.repeat(60));
console.log('\nSummary:');
console.log('  Total directories: ' + uniqueDirectories.length);
console.log('  Total files: ' + fileCount);
console.log('  Page modules: ' + pagesDirs.length);
console.log('  Step modules: ' + stepsDirs.length);
console.log('  Feature folders: ' + featuresDirs.length);
console.log('  Environments: ' + envDirs.join(', '));
console.log('\nTarget project created at: ' + targetDir);
console.log('\nNext steps:');
console.log('  1. cd ' + targetDir);
console.log('  2. npm install');
console.log('  3. npx playwright install');
console.log('  4. Run the remaining migration scripts');
