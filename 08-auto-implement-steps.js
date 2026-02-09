#!/usr/bin/env node
/**
 * Script 08: Batch Implement Step Definitions
 * 
 * Analyzes Java step definitions and auto-implements Playwright equivalents
 * based on common QAF/Cucumber step patterns.
 * 
 * Usage: node scripts/08-auto-implement-steps.js <config-path>
 */

const fs = require('fs');
const path = require('path');

const configPath = process.argv[2] || './migration-config.json';

console.log('='.repeat(60));
console.log('  SCRIPT 08: AUTO-IMPLEMENT STEP DEFINITIONS');
console.log('='.repeat(60));

// Load configuration
if (!fs.existsSync(configPath)) {
  console.log('\n[ERROR] Configuration file not found: ' + configPath);
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

const sourceRoot = config.source.rootDir;
const targetRoot = config.target.rootDir;
const sourceStepsPath = config.source.steps?.path || 'src/steps';
const targetStepsPath = config.target.steps || 'src/steps';

const sourceDir = path.join(sourceRoot, sourceStepsPath);
const targetDir = path.join(targetRoot, targetStepsPath);

console.log('\n[INFO] Configuration loaded');
console.log('  Source steps: ' + sourceDir);
console.log('  Target steps: ' + targetDir);

let stats = {
  filesProcessed: 0,
  stepsImplemented: 0,
  stepsSkipped: 0
};

/**
 * Common step patterns and their Playwright implementations
 */
const stepPatterns = [
  // Navigation patterns
  {
    pattern: /user (?:navigates?|goes?) to ['"]?(.+?)['"]?$/i,
    implement: (matches, params) => `await page.goto('${matches[1] || params[0]?.name || '/'}');
    await page.waitForLoadState('networkidle');`
  },
  {
    pattern: /user (?:is on|opens?) (?:the )?['"]?(.+?)['"]? page$/i,
    implement: (matches, params) => `await page.goto('/${matches[1]?.toLowerCase().replace(/\s+/g, '-') || ''}');
    await page.waitForLoadState('networkidle');`
  },
  
  // Click patterns
  {
    pattern: /user clicks? (?:on )?(?:the )?['"]?(.+?)['"]?$/i,
    implement: (matches, params) => {
      const target = matches[1] || params[0]?.name;
      if (target?.toLowerCase().includes('button')) {
        return `await page.getByRole('button', { name: /${target.replace(/button/i, '').trim()}/i }).click();`;
      } else if (target?.toLowerCase().includes('link')) {
        return `await page.getByRole('link', { name: /${target.replace(/link/i, '').trim()}/i }).click();`;
      }
      return `await page.getByText('${target}').click();`;
    }
  },
  {
    pattern: /user clicks? (?:on )?(?:the )?button ['"]?(.+?)['"]?$/i,
    implement: (matches, params) => `await page.getByRole('button', { name: '${matches[1] || params[0]?.name}' }).click();`
  },
  {
    pattern: /user clicks? (?:on )?(?:the )?link ['"]?(.+?)['"]?$/i,
    implement: (matches, params) => `await page.getByRole('link', { name: '${matches[1] || params[0]?.name}' }).click();`
  },
  {
    pattern: /user clicks? (?:on )?(?:the )?tab ['"]?(.+?)['"]?$/i,
    implement: (matches, params) => `await page.getByRole('tab', { name: '${matches[1] || params[0]?.name}' }).click();`
  },
  {
    pattern: /user clicks? (?:on )?(?:an? )?Account$/i,
    implement: () => `await page.locator('table tbody tr').first().click();`
  },
  
  // Input patterns
  {
    pattern: /user (?:enters?|types?|inputs?) ['"]?(.+?)['"]? (?:in|into) (?:the )?['"]?(.+?)['"]?(?: field)?$/i,
    implement: (matches, params) => {
      const value = matches[1] || params[0]?.name;
      const field = matches[2] || params[1]?.name;
      return `await page.getByLabel('${field}').fill(${value.startsWith('{') ? params[0]?.name : `'${value}'`});`;
    }
  },
  {
    pattern: /user (?:enters?|types?|fills?) ['"]?(.+?)['"]?$/i,
    implement: (matches, params) => {
      const value = params[0]?.name || `'${matches[1]}'`;
      return `await page.locator('input:focus, textarea:focus').fill(${value});`;
    }
  },
  {
    pattern: /user clears? (?:the )?['"]?(.+?)['"]?(?: field)?$/i,
    implement: (matches, params) => `await page.getByLabel('${matches[1] || params[0]?.name}').clear();`
  },
  
  // Select/dropdown patterns
  {
    pattern: /user selects? ['"]?(.+?)['"]? from (?:the )?['"]?(.+?)['"]?(?: dropdown)?$/i,
    implement: (matches, params) => {
      const option = matches[1] || params[0]?.name;
      const dropdown = matches[2] || params[1]?.name;
      return `await page.getByLabel('${dropdown}').selectOption('${option}');`;
    }
  },
  {
    pattern: /user selects? (?:the )?option ['"]?(.+?)['"]?$/i,
    implement: (matches, params) => `await page.getByRole('option', { name: '${matches[1] || params[0]?.name}' }).click();`
  },
  
  // Checkbox patterns
  {
    pattern: /user (?:checks?|selects?) (?:the )?['"]?(.+?)['"]? checkbox$/i,
    implement: (matches, params) => `await page.getByLabel('${matches[1] || params[0]?.name}').check();`
  },
  {
    pattern: /user unchecks? (?:the )?['"]?(.+?)['"]? checkbox$/i,
    implement: (matches, params) => `await page.getByLabel('${matches[1] || params[0]?.name}').uncheck();`
  },
  
  // Wait patterns
  {
    pattern: /user waits? for (?:the )?page to load$/i,
    implement: () => `await page.waitForLoadState('networkidle');`
  },
  {
    pattern: /user waits? for (\d+) seconds?$/i,
    implement: (matches, params) => `await page.waitForTimeout(${(matches[1] || params[0]?.name) * 1000});`
  },
  {
    pattern: /user waits? (?:for )?(?:the )?['"]?(.+?)['"]? (?:to be )?(?:visible|displayed)$/i,
    implement: (matches, params) => `await page.getByText('${matches[1] || params[0]?.name}').waitFor({ state: 'visible' });`
  },
  
  // Verification patterns
  {
    pattern: /(?:user )?(?:should )?sees? (?:the )?(?:text )?['"]?(.+?)['"]?$/i,
    implement: (matches, params) => `await expect(page.getByText('${matches[1] || params[0]?.name}')).toBeVisible();`
  },
  {
    pattern: /(?:user )?(?:should )?sees? (?:the )?['"]?(.+?)['"]? (?:is )?displayed$/i,
    implement: (matches, params) => `await expect(page.getByText('${matches[1] || params[0]?.name}')).toBeVisible();`
  },
  {
    pattern: /(?:the )?page title should (?:be|contain) ['"]?(.+?)['"]?$/i,
    implement: (matches, params) => `await expect(page).toHaveTitle(/${matches[1] || params[0]?.name}/i);`
  },
  {
    pattern: /(?:the )?URL should contain ['"]?(.+?)['"]?$/i,
    implement: (matches, params) => `await expect(page).toHaveURL(/${matches[1] || params[0]?.name}/);`
  },
  {
    pattern: /(?:user )?validates? (?:the )?['"]?(.+?)['"]?(?: tab)?(?: fields)?$/i,
    implement: (matches, params) => {
      const section = matches[1] || params[0]?.name || 'section';
      return `// Validate ${section}
    await expect(page.locator('[data-testid="${section.toLowerCase().replace(/\s+/g, '-')}"]')).toBeVisible();`;
    }
  },
  {
    pattern: /(?:the )?['"]?(.+?)['"]? should be (?:visible|displayed)$/i,
    implement: (matches, params) => `await expect(page.getByText('${matches[1] || params[0]?.name}')).toBeVisible();`
  },
  {
    pattern: /(?:the )?['"]?(.+?)['"]? should not be (?:visible|displayed)$/i,
    implement: (matches, params) => `await expect(page.getByText('${matches[1] || params[0]?.name}')).toBeHidden();`
  },
  {
    pattern: /(?:the )?['"]?(.+?)['"]? should (?:have|contain) (?:text|value) ['"]?(.+?)['"]?$/i,
    implement: (matches, params) => `await expect(page.getByLabel('${matches[1]}')).toHaveValue('${matches[2] || params[0]?.name}');`
  },
  {
    pattern: /account details should be displayed$/i,
    implement: () => `await expect(page.locator('[data-testid="account-details"]')).toBeVisible();
    // Or use a more specific locator based on your app structure`
  },
  
  // Login/logout patterns
  {
    pattern: /user logs? in(?:to)? (?:with )?(?:default )?(?:credentials)?/i,
    implement: () => `// Login with default credentials
    await page.getByLabel('Username').fill(process.env.DEFAULT_USER || 'testuser');
    await page.getByLabel('Password').fill(process.env.DEFAULT_PASS || 'testpass');
    await page.getByRole('button', { name: /login|sign in/i }).click();
    await page.waitForLoadState('networkidle');`
  },
  {
    pattern: /user logs? out$/i,
    implement: () => `await page.getByRole('button', { name: /logout|sign out/i }).click();
    await page.waitForLoadState('networkidle');`
  },
  
  // Table patterns
  {
    pattern: /user clicks? (?:on )?row (\d+)/i,
    implement: (matches, params) => `await page.locator('table tbody tr').nth(${(matches[1] || params[0]?.name) - 1}).click();`
  },
  {
    pattern: /user clicks? (?:on )?(?:the )?first row/i,
    implement: () => `await page.locator('table tbody tr').first().click();`
  },
  
  // Scroll patterns
  {
    pattern: /user scrolls? (?:to )?(?:the )?(?:bottom|end)/i,
    implement: () => `await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));`
  },
  {
    pattern: /user scrolls? (?:to )?(?:the )?top/i,
    implement: () => `await page.evaluate(() => window.scrollTo(0, 0));`
  },
  
  // Keyboard patterns
  {
    pattern: /user presses? (?:the )?(?:Enter|Return) key$/i,
    implement: () => `await page.keyboard.press('Enter');`
  },
  {
    pattern: /user presses? (?:the )?Tab key$/i,
    implement: () => `await page.keyboard.press('Tab');`
  },
  {
    pattern: /user presses? (?:the )?Escape key$/i,
    implement: () => `await page.keyboard.press('Escape');`
  }
];

/**
 * Try to match step description against patterns
 */
function matchStepPattern(description, params) {
  for (const { pattern, implement } of stepPatterns) {
    const matches = description.match(pattern);
    if (matches) {
      try {
        return implement(matches, params);
      } catch (e) {
        // Pattern matched but implementation failed
        continue;
      }
    }
  }
  return null;
}

/**
 * Parse Java step definitions
 */
function parseJavaSteps(content) {
  const steps = [];
  
  // Match @QAFTestStep or Cucumber annotations
  const stepRegex = /@(?:QAFTestStep\s*\(\s*description\s*=\s*|Given|When|Then)\s*\(\s*["'](.+?)["']\s*\)\s*(?:public\s+)?(?:void|boolean|String|\w+)\s+(\w+)\s*\(([^)]*)\)\s*\{/g;
  let match;
  
  while ((match = stepRegex.exec(content)) !== null) {
    const description = match[1];
    const methodName = match[2];
    const paramsStr = match[3];
    
    // Find method body
    const startIndex = match.index + match[0].length;
    let braceCount = 1;
    let endIndex = startIndex;
    while (braceCount > 0 && endIndex < content.length) {
      if (content[endIndex] === '{') braceCount++;
      if (content[endIndex] === '}') braceCount--;
      endIndex++;
    }
    
    const body = content.substring(startIndex, endIndex - 1).trim();
    
    // Parse parameters
    const params = paramsStr.split(',').filter(p => p.trim()).map(p => {
      const parts = p.trim().split(/\s+/);
      const type = parts[0].toLowerCase().includes('string') ? 'string' : 
                   parts[0].toLowerCase().includes('int') ? 'number' : 'string';
      const name = parts[parts.length - 1];
      return { name, type };
    });
    
    steps.push({
      description,
      methodName,
      params,
      body
    });
  }
  
  return steps;
}

/**
 * Update TypeScript step file
 */
function updateTypeScriptStepFile(tsFilePath, javaContent) {
  if (!fs.existsSync(tsFilePath)) {
    console.log('  [SKIP] File not found: ' + tsFilePath);
    return 0;
  }
  
  let tsContent = fs.readFileSync(tsFilePath, 'utf8');
  const javaSteps = parseJavaSteps(javaContent);
  
  let implementedCount = 0;
  
  javaSteps.forEach(step => {
    // Check if step has TODO
    const escapedDesc = step.description.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const todoPattern = new RegExp(
      `(Given|When|Then)\\s*\\(\\s*['"]${escapedDesc}['"]\\s*,\\s*async[^{]+\\{[^}]*TODO[^}]*\\}`,
      'i'
    );
    
    if (!todoPattern.test(tsContent)) {
      return;
    }
    
    // Try to match against patterns
    let implementation = matchStepPattern(step.description, step.params);
    
    if (implementation) {
      // Build replacement
      const tsParams = step.params.length > 0 
        ? `{ page }, ${step.params.map(p => `${p.name}: ${p.type}`).join(', ')}`
        : '{ page }';
      
      const stepType = step.description.toLowerCase().startsWith('user should') ||
                       step.description.toLowerCase().includes('should be') ||
                       step.description.toLowerCase().includes('validates') ? 'Then' :
                       step.description.toLowerCase().includes('given') ||
                       step.description.toLowerCase().includes('logged in') ? 'Given' : 'When';
      
      const newStep = `${stepType}('${step.description}', async (${tsParams}) => {
    ${implementation}
  })`;
      
      tsContent = tsContent.replace(todoPattern, newStep);
      implementedCount++;
      stats.stepsImplemented++;
    } else {
      stats.stepsSkipped++;
    }
  });
  
  if (implementedCount > 0) {
    fs.writeFileSync(tsFilePath, tsContent);
  }
  
  return implementedCount;
}

/**
 * Process directories
 */
function processDirectory(srcPath, tgtPath) {
  if (!fs.existsSync(srcPath) || !fs.existsSync(tgtPath)) return;
  
  const items = fs.readdirSync(srcPath);
  
  items.forEach(item => {
    const srcItemPath = path.join(srcPath, item);
    const srcStats = fs.statSync(srcItemPath);
    
    if (srcStats.isDirectory()) {
      processDirectory(srcItemPath, path.join(tgtPath, item.toLowerCase()));
    } else if (item.endsWith('Steps.java') || item.endsWith('Step.java')) {
      // Find corresponding TS file
      const tsFileName = item
        .replace(/Steps?\.java$/i, '')
        .replace(/([a-z])([A-Z])/g, '$1-$2')
        .toLowerCase() + '.steps.ts';
      
      const tsFilePath = path.join(tgtPath, tsFileName);
      
      if (fs.existsSync(tsFilePath)) {
        const javaContent = fs.readFileSync(srcItemPath, 'utf8');
        const implemented = updateTypeScriptStepFile(tsFilePath, javaContent);
        
        if (implemented > 0) {
          console.log(`  [UPDATED] ${tsFileName} (${implemented} steps implemented)`);
        } else {
          console.log(`  [NO CHANGES] ${tsFileName}`);
        }
        stats.filesProcessed++;
      }
    }
  });
}

console.log('\n[INFO] Auto-implementing step definitions...\n');
processDirectory(sourceDir, targetDir);

// Summary
console.log('\n' + '='.repeat(60));
console.log('  AUTO-IMPLEMENTATION COMPLETE');
console.log('='.repeat(60));
console.log('\nSummary:');
console.log('  Files processed: ' + stats.filesProcessed);
console.log('  Steps implemented: ' + stats.stepsImplemented);
console.log('  Steps skipped (complex): ' + stats.stepsSkipped);

const totalSteps = stats.stepsImplemented + stats.stepsSkipped;
if (totalSteps > 0) {
  const percentage = Math.round((stats.stepsImplemented / totalSteps) * 100);
  console.log(`\nAutomation rate: ${percentage}% (${stats.stepsImplemented}/${totalSteps})`);
}

console.log('\nRemaining TODOs need manual review or Copilot assistance.');
