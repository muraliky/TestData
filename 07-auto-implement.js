#!/usr/bin/env node
/**
 * Script 07: Auto-Implement Page Methods
 * 
 * This script analyzes the original Java source files and automatically
 * implements Playwright methods based on common patterns, reducing the
 * need for Copilot/manual intervention.
 * 
 * Patterns detected:
 *   - click operations
 *   - text input (sendKeys, fill)
 *   - getText / getValue
 *   - waitFor operations
 *   - select dropdown
 *   - checkbox/radio operations
 *   - assertions (verify, validate)
 *   - navigation
 *   - table operations
 * 
 * Usage: node scripts/07-auto-implement.js <config-path>
 */

const fs = require('fs');
const path = require('path');

const configPath = process.argv[2] || './migration-config.json';

console.log('='.repeat(60));
console.log('  SCRIPT 07: AUTO-IMPLEMENT PAGE METHODS');
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
const sourcePagesPath = config.source.pages?.path || 'src/pages';
const targetPagesPath = config.target.pages || 'src/pages';

const sourceDir = path.join(sourceRoot, sourcePagesPath);
const targetDir = path.join(targetRoot, targetPagesPath);

console.log('\n[INFO] Configuration loaded');
console.log('  Source pages: ' + sourceDir);
console.log('  Target pages: ' + targetDir);

let stats = {
  filesProcessed: 0,
  methodsImplemented: 0,
  methodsSkipped: 0,
  patternsMatched: {}
};

/**
 * Convert Java method body to Playwright implementation
 */
function analyzeAndImplementMethod(methodName, methodBody, params, locators) {
  const lowerName = methodName.toLowerCase();
  const lowerBody = methodBody.toLowerCase();
  
  // Track which pattern matched
  let pattern = null;
  let implementation = null;
  
  // Pattern: Click operations
  if (lowerName.includes('click') || lowerBody.includes('.click()')) {
    pattern = 'click';
    const locatorMatch = methodBody.match(/(\w+)\.click\(\)/);
    if (locatorMatch && locators.includes(locatorMatch[1])) {
      implementation = `await this.${locatorMatch[1]}.click();`;
    } else if (params.length > 0) {
      implementation = `await this.page.getByRole('button', { name: ${params[0].name} }).click();`;
    } else {
      // Try to infer locator from method name
      const inferredLocator = inferLocatorFromMethodName(methodName, locators);
      if (inferredLocator) {
        implementation = `await this.${inferredLocator}.click();`;
      }
    }
  }
  
  // Pattern: Double click
  else if (lowerName.includes('doubleclick') || lowerBody.includes('.doubleclick()')) {
    pattern = 'doubleClick';
    const locatorMatch = methodBody.match(/(\w+)\.doubleClick\(\)/i);
    if (locatorMatch && locators.includes(locatorMatch[1])) {
      implementation = `await this.${locatorMatch[1]}.dblclick();`;
    }
  }
  
  // Pattern: Right click / context click
  else if (lowerName.includes('rightclick') || lowerBody.includes('.contextclick()')) {
    pattern = 'rightClick';
    const locatorMatch = methodBody.match(/(\w+)\.contextClick\(\)/i);
    if (locatorMatch && locators.includes(locatorMatch[1])) {
      implementation = `await this.${locatorMatch[1]}.click({ button: 'right' });`;
    }
  }
  
  // Pattern: Text input (sendKeys, fill, type, enter)
  else if (lowerName.includes('enter') || lowerName.includes('type') || lowerName.includes('input') || 
           lowerName.includes('fill') || lowerBody.includes('.sendkeys(') || lowerBody.includes('.clear()')) {
    pattern = 'textInput';
    const locatorMatch = methodBody.match(/(\w+)\.(?:sendKeys|clear)\(/i);
    const textParam = params.find(p => p.type === 'string' || p.name.toLowerCase().includes('text') || 
                                        p.name.toLowerCase().includes('value'));
    
    if (locatorMatch && locators.includes(locatorMatch[1])) {
      if (lowerBody.includes('.clear()')) {
        implementation = `await this.${locatorMatch[1]}.clear();\n    await this.${locatorMatch[1]}.fill(${textParam ? textParam.name : "''"});`;
      } else {
        implementation = `await this.${locatorMatch[1]}.fill(${textParam ? textParam.name : "''"});`;
      }
    } else if (textParam) {
      const inferredLocator = inferLocatorFromMethodName(methodName, locators);
      if (inferredLocator) {
        implementation = `await this.${inferredLocator}.fill(${textParam.name});`;
      }
    }
  }
  
  // Pattern: Get text
  else if (lowerName.includes('gettext') || lowerName.includes('getvalue') || lowerBody.includes('.gettext()')) {
    pattern = 'getText';
    const locatorMatch = methodBody.match(/(\w+)\.getText\(\)/i);
    if (locatorMatch && locators.includes(locatorMatch[1])) {
      implementation = `return await this.${locatorMatch[1]}.innerText();`;
    } else {
      const inferredLocator = inferLocatorFromMethodName(methodName, locators);
      if (inferredLocator) {
        implementation = `return await this.${inferredLocator}.innerText();`;
      }
    }
  }
  
  // Pattern: Get attribute
  else if (lowerName.includes('getattribute') || lowerBody.includes('.getattribute(')) {
    pattern = 'getAttribute';
    const attrMatch = methodBody.match(/\.getAttribute\s*\(\s*["'](\w+)["']\s*\)/i);
    const locatorMatch = methodBody.match(/(\w+)\.getAttribute/i);
    if (locatorMatch && locators.includes(locatorMatch[1]) && attrMatch) {
      implementation = `return await this.${locatorMatch[1]}.getAttribute('${attrMatch[1]}');`;
    }
  }
  
  // Pattern: Wait for element
  else if (lowerName.includes('wait') || lowerBody.includes('waitfor') || lowerBody.includes('wait.until')) {
    pattern = 'wait';
    if (lowerBody.includes('visible') || lowerBody.includes('displayed')) {
      const locatorMatch = methodBody.match(/visibilityOf(?:Element)?(?:Located)?\s*\(\s*(\w+)\s*\)/i);
      if (locatorMatch && locators.includes(locatorMatch[1])) {
        implementation = `await this.${locatorMatch[1]}.waitFor({ state: 'visible' });`;
      } else {
        implementation = `await this.page.waitForLoadState('networkidle');`;
      }
    } else if (lowerBody.includes('clickable')) {
      const locatorMatch = methodBody.match(/elementToBeClickable\s*\(\s*(\w+)\s*\)/i);
      if (locatorMatch && locators.includes(locatorMatch[1])) {
        implementation = `await this.${locatorMatch[1]}.waitFor({ state: 'visible' });\n    await expect(this.${locatorMatch[1]}).toBeEnabled();`;
      }
    } else if (lowerBody.includes('invisible') || lowerBody.includes('notvisible')) {
      const locatorMatch = methodBody.match(/invisibilityOf\s*\(\s*(\w+)\s*\)/i);
      if (locatorMatch && locators.includes(locatorMatch[1])) {
        implementation = `await this.${locatorMatch[1]}.waitFor({ state: 'hidden' });`;
      }
    } else {
      implementation = `await this.page.waitForLoadState('networkidle');`;
    }
  }
  
  // Pattern: Select dropdown
  else if (lowerName.includes('select') || lowerBody.includes('select.') || lowerBody.includes('.selectby')) {
    pattern = 'select';
    if (lowerBody.includes('selectbyvisibletext') || lowerBody.includes('selectbytext')) {
      const textParam = params.find(p => p.type === 'string');
      const locatorMatch = methodBody.match(/new\s+Select\s*\(\s*(\w+)\s*\)/i) || 
                          methodBody.match(/(\w+)\.selectBy/i);
      if (locatorMatch && textParam) {
        implementation = `await this.${locatorMatch[1]}.selectOption({ label: ${textParam.name} });`;
      }
    } else if (lowerBody.includes('selectbyvalue')) {
      const valueParam = params.find(p => p.type === 'string');
      const locatorMatch = methodBody.match(/new\s+Select\s*\(\s*(\w+)\s*\)/i);
      if (locatorMatch && valueParam) {
        implementation = `await this.${locatorMatch[1]}.selectOption({ value: ${valueParam.name} });`;
      }
    } else if (lowerBody.includes('selectbyindex')) {
      const indexParam = params.find(p => p.type === 'number' || p.name.includes('index'));
      const locatorMatch = methodBody.match(/new\s+Select\s*\(\s*(\w+)\s*\)/i);
      if (locatorMatch && indexParam) {
        implementation = `await this.${locatorMatch[1]}.selectOption({ index: ${indexParam.name} });`;
      }
    }
  }
  
  // Pattern: Checkbox operations
  else if (lowerName.includes('checkbox') || lowerName.includes('check') || 
           lowerBody.includes('.isselected()')) {
    pattern = 'checkbox';
    if (lowerName.includes('uncheck') || lowerBody.includes('if') && lowerBody.includes('isselected')) {
      const locatorMatch = methodBody.match(/(\w+)\.(?:click|isSelected)/i);
      if (locatorMatch && locators.includes(locatorMatch[1])) {
        implementation = `await this.${locatorMatch[1]}.uncheck();`;
      }
    } else {
      const locatorMatch = methodBody.match(/(\w+)\.(?:click|isSelected)/i);
      if (locatorMatch && locators.includes(locatorMatch[1])) {
        implementation = `await this.${locatorMatch[1]}.check();`;
      }
    }
  }
  
  // Pattern: Is displayed / is visible
  else if (lowerName.includes('isdisplayed') || lowerName.includes('isvisible') || 
           lowerBody.includes('.isdisplayed()')) {
    pattern = 'isVisible';
    const locatorMatch = methodBody.match(/(\w+)\.isDisplayed\(\)/i);
    if (locatorMatch && locators.includes(locatorMatch[1])) {
      implementation = `return await this.${locatorMatch[1]}.isVisible();`;
    } else {
      const inferredLocator = inferLocatorFromMethodName(methodName, locators);
      if (inferredLocator) {
        implementation = `return await this.${inferredLocator}.isVisible();`;
      }
    }
  }
  
  // Pattern: Is enabled
  else if (lowerName.includes('isenabled') || lowerBody.includes('.isenabled()')) {
    pattern = 'isEnabled';
    const locatorMatch = methodBody.match(/(\w+)\.isEnabled\(\)/i);
    if (locatorMatch && locators.includes(locatorMatch[1])) {
      implementation = `return await this.${locatorMatch[1]}.isEnabled();`;
    }
  }
  
  // Pattern: Hover / mouse over
  else if (lowerName.includes('hover') || lowerName.includes('mouseover') || 
           lowerBody.includes('.movetoelement(')) {
    pattern = 'hover';
    const locatorMatch = methodBody.match(/moveToElement\s*\(\s*(\w+)\s*\)/i);
    if (locatorMatch && locators.includes(locatorMatch[1])) {
      implementation = `await this.${locatorMatch[1]}.hover();`;
    } else {
      const inferredLocator = inferLocatorFromMethodName(methodName, locators);
      if (inferredLocator) {
        implementation = `await this.${inferredLocator}.hover();`;
      }
    }
  }
  
  // Pattern: Scroll
  else if (lowerName.includes('scroll') || lowerBody.includes('scrollintoview')) {
    pattern = 'scroll';
    const locatorMatch = methodBody.match(/scrollIntoView[^(]*\(\s*(\w+)\s*\)/i) ||
                        methodBody.match(/(\w+)[^.]*\.scrollIntoView/i);
    if (locatorMatch && locators.includes(locatorMatch[1])) {
      implementation = `await this.${locatorMatch[1]}.scrollIntoViewIfNeeded();`;
    } else {
      implementation = `await this.page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));`;
    }
  }
  
  // Pattern: Navigate / go to URL
  else if (lowerName.includes('navigate') || lowerName.includes('goto') || 
           lowerName.includes('openpage') || lowerBody.includes('.get(') || 
           lowerBody.includes('.navigate()')) {
    pattern = 'navigate';
    const urlMatch = methodBody.match(/\.get\s*\(\s*["']([^"']+)["']\s*\)/i);
    if (urlMatch) {
      implementation = `await this.page.goto('${urlMatch[1]}');\n    await this.page.waitForLoadState('networkidle');`;
    } else {
      const urlParam = params.find(p => p.name.toLowerCase().includes('url'));
      if (urlParam) {
        implementation = `await this.page.goto(${urlParam.name});\n    await this.page.waitForLoadState('networkidle');`;
      }
    }
  }
  
  // Pattern: Switch to frame/iframe
  else if (lowerName.includes('frame') || lowerBody.includes('switchto().frame')) {
    pattern = 'frame';
    const frameMatch = methodBody.match(/frame\s*\(\s*["']([^"']+)["']\s*\)/i) ||
                      methodBody.match(/frame\s*\(\s*(\w+)\s*\)/i);
    if (frameMatch) {
      implementation = `const frame = this.page.frameLocator('${frameMatch[1]}');`;
    }
  }
  
  // Pattern: Accept/dismiss alert
  else if (lowerName.includes('alert') || lowerBody.includes('switchto().alert')) {
    pattern = 'alert';
    if (lowerBody.includes('.accept()')) {
      implementation = `this.page.on('dialog', dialog => dialog.accept());`;
    } else if (lowerBody.includes('.dismiss()')) {
      implementation = `this.page.on('dialog', dialog => dialog.dismiss());`;
    }
  }
  
  // Pattern: Get count / size
  else if (lowerName.includes('getcount') || lowerName.includes('getsize') || 
           lowerBody.includes('.size()')) {
    pattern = 'count';
    const locatorMatch = methodBody.match(/(\w+)\.size\(\)/i) ||
                        methodBody.match(/(\w+)\.findElements/i);
    if (locatorMatch && locators.includes(locatorMatch[1])) {
      implementation = `return await this.${locatorMatch[1]}.count();`;
    }
  }
  
  // Pattern: Verify / validate / assert (convert to expect)
  else if (lowerName.includes('verify') || lowerName.includes('validate') || 
           lowerName.includes('assert') || lowerBody.includes('assert.')) {
    pattern = 'assertion';
    if (lowerBody.includes('assertequals') || lowerBody.includes('asserttrue')) {
      implementation = `// TODO: Add assertion\n    // await expect(locator).toHaveText(expected);`;
    } else if (lowerName.includes('displayed') || lowerName.includes('visible')) {
      const inferredLocator = inferLocatorFromMethodName(methodName, locators);
      if (inferredLocator) {
        implementation = `await expect(this.${inferredLocator}).toBeVisible();`;
      }
    }
  }
  
  // Pattern: Clear field
  else if (lowerName.includes('clear') && !lowerName.includes('click')) {
    pattern = 'clear';
    const locatorMatch = methodBody.match(/(\w+)\.clear\(\)/i);
    if (locatorMatch && locators.includes(locatorMatch[1])) {
      implementation = `await this.${locatorMatch[1]}.clear();`;
    }
  }
  
  // Pattern: Press key / keyboard
  else if (lowerName.includes('press') || lowerName.includes('key') || 
           lowerBody.includes('.sendkeys(keys.')) {
    pattern = 'keyboard';
    const keyMatch = methodBody.match(/Keys\.(\w+)/i);
    if (keyMatch) {
      const keyMap = {
        'ENTER': 'Enter', 'RETURN': 'Enter', 'TAB': 'Tab', 'ESCAPE': 'Escape',
        'BACKSPACE': 'Backspace', 'DELETE': 'Delete', 'SPACE': 'Space',
        'ARROW_UP': 'ArrowUp', 'ARROW_DOWN': 'ArrowDown', 
        'ARROW_LEFT': 'ArrowLeft', 'ARROW_RIGHT': 'ArrowRight'
      };
      const playwrightKey = keyMap[keyMatch[1].toUpperCase()] || keyMatch[1];
      implementation = `await this.page.keyboard.press('${playwrightKey}');`;
    }
  }
  
  // Pattern: Focus
  else if (lowerName.includes('focus') || lowerBody.includes('.focus()')) {
    pattern = 'focus';
    const locatorMatch = methodBody.match(/(\w+)\.focus\(\)/i);
    if (locatorMatch && locators.includes(locatorMatch[1])) {
      implementation = `await this.${locatorMatch[1]}.focus();`;
    }
  }
  
  // Pattern: Blur
  else if (lowerName.includes('blur') || lowerBody.includes('.blur()')) {
    pattern = 'blur';
    const locatorMatch = methodBody.match(/(\w+)\.blur\(\)/i);
    if (locatorMatch && locators.includes(locatorMatch[1])) {
      implementation = `await this.${locatorMatch[1]}.blur();`;
    }
  }
  
  // Track pattern statistics
  if (pattern) {
    stats.patternsMatched[pattern] = (stats.patternsMatched[pattern] || 0) + 1;
  }
  
  return { pattern, implementation };
}

/**
 * Infer locator name from method name
 */
function inferLocatorFromMethodName(methodName, locators) {
  // Remove common prefixes/suffixes
  let baseName = methodName
    .replace(/^(click|enter|type|get|set|verify|validate|check|select|wait|hover)/i, '')
    .replace(/(Button|Link|Text|Field|Input|Checkbox|Dropdown|Element)$/i, '');
  
  // Try direct match
  const directMatch = locators.find(l => l.toLowerCase() === baseName.toLowerCase());
  if (directMatch) return directMatch;
  
  // Try contains match
  const containsMatch = locators.find(l => 
    l.toLowerCase().includes(baseName.toLowerCase()) ||
    baseName.toLowerCase().includes(l.toLowerCase())
  );
  if (containsMatch) return containsMatch;
  
  // Try camelCase variations
  const camelBase = baseName.charAt(0).toLowerCase() + baseName.slice(1);
  const camelMatch = locators.find(l => l === camelBase || l === baseName);
  if (camelMatch) return camelMatch;
  
  return null;
}

/**
 * Parse Java method with body
 */
function parseJavaMethodsWithBody(content) {
  const methods = [];
  
  // Match method signature and body
  const methodRegex = /public\s+(?:static\s+)?(\w+(?:<[\w<>,\s]+>)?)\s+(\w+)\s*\(([^)]*)\)\s*(?:throws\s+[\w,\s]+)?\s*\{/g;
  let match;
  
  while ((match = methodRegex.exec(content)) !== null) {
    const returnType = match[1];
    const methodName = match[2];
    const paramsStr = match[3];
    const startIndex = match.index + match[0].length;
    
    // Find matching closing brace
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
                   parts[0].toLowerCase().includes('int') ? 'number' : 'any';
      const name = parts[parts.length - 1];
      return { name, type };
    });
    
    // Skip getters/setters and standard methods
    if (['toString', 'equals', 'hashCode', 'getClass'].includes(methodName)) continue;
    if (methodName.match(/^(get|set)[A-Z]/) && params.length === 0) continue;
    
    methods.push({
      name: methodName,
      returnType,
      params,
      body
    });
  }
  
  return methods;
}

/**
 * Update TypeScript file with implementations
 */
function updateTypeScriptFile(tsFilePath, javaContent) {
  if (!fs.existsSync(tsFilePath)) {
    console.log('  [SKIP] TypeScript file not found: ' + tsFilePath);
    return 0;
  }
  
  let tsContent = fs.readFileSync(tsFilePath, 'utf8');
  
  // Extract locator names from TS file
  const locatorMatches = tsContent.matchAll(/readonly\s+(\w+):\s*Locator/g);
  const locators = [...locatorMatches].map(m => m[1]);
  
  // Parse Java methods
  const javaMethods = parseJavaMethodsWithBody(javaContent);
  
  let implementedCount = 0;
  
  javaMethods.forEach(method => {
    // Check if this method exists as a TODO in the TS file
    const todoPattern = new RegExp(
      `async\\s+${method.name}\\s*\\([^)]*\\)\\s*:\\s*Promise<[^>]+>\\s*\\{[^}]*TODO[^}]*\\}`,
      'i'
    );
    
    if (!todoPattern.test(tsContent)) {
      // Method either doesn't exist or is already implemented
      return;
    }
    
    // Analyze and implement
    const result = analyzeAndImplementMethod(method.name, method.body, method.params, locators);
    
    if (result.implementation) {
      // Build the replacement method
      const tsParams = method.params.map(p => `${p.name}: ${p.type}`).join(', ');
      const returnType = method.returnType.toLowerCase().includes('void') ? 'void' :
                        method.returnType.toLowerCase().includes('string') ? 'string' :
                        method.returnType.toLowerCase().includes('boolean') ? 'boolean' :
                        method.returnType.toLowerCase().includes('int') ? 'number' : 'void';
      
      const newMethod = `async ${method.name}(${tsParams}): Promise<${returnType}> {
    ${result.implementation}
  }`;
      
      // Replace the TODO method
      tsContent = tsContent.replace(todoPattern, newMethod);
      implementedCount++;
      stats.methodsImplemented++;
    } else {
      stats.methodsSkipped++;
    }
  });
  
  if (implementedCount > 0) {
    fs.writeFileSync(tsFilePath, tsContent);
  }
  
  return implementedCount;
}

/**
 * Process directory
 */
function processDirectory(srcPath, tgtPath) {
  if (!fs.existsSync(srcPath) || !fs.existsSync(tgtPath)) return;
  
  const items = fs.readdirSync(srcPath);
  
  items.forEach(item => {
    const srcItemPath = path.join(srcPath, item);
    const srcStats = fs.statSync(srcItemPath);
    
    if (srcStats.isDirectory()) {
      processDirectory(srcItemPath, path.join(tgtPath, item.toLowerCase()));
    } else if (item.endsWith('Page.java') || item.endsWith('page.java')) {
      // Find corresponding TS file
      const tsFileName = item
        .replace(/Page\.java$/i, '')
        .replace(/([a-z])([A-Z])/g, '$1-$2')
        .toLowerCase() + '.page.ts';
      
      const tsFilePath = path.join(tgtPath, tsFileName);
      
      if (fs.existsSync(tsFilePath)) {
        const javaContent = fs.readFileSync(srcItemPath, 'utf8');
        const implemented = updateTypeScriptFile(tsFilePath, javaContent);
        
        if (implemented > 0) {
          console.log(`  [UPDATED] ${tsFileName} (${implemented} methods implemented)`);
        } else {
          console.log(`  [NO CHANGES] ${tsFileName}`);
        }
        stats.filesProcessed++;
      }
    }
  });
}

console.log('\n[INFO] Analyzing Java source and implementing methods...\n');
processDirectory(sourceDir, targetDir);

// Summary
console.log('\n' + '='.repeat(60));
console.log('  AUTO-IMPLEMENTATION COMPLETE');
console.log('='.repeat(60));
console.log('\nSummary:');
console.log('  Files processed: ' + stats.filesProcessed);
console.log('  Methods implemented: ' + stats.methodsImplemented);
console.log('  Methods skipped (complex): ' + stats.methodsSkipped);

if (Object.keys(stats.patternsMatched).length > 0) {
  console.log('\nPatterns matched:');
  Object.entries(stats.patternsMatched)
    .sort((a, b) => b[1] - a[1])
    .forEach(([pattern, count]) => {
      console.log(`  - ${pattern}: ${count}`);
    });
}

console.log('\nRemaining TODOs need manual review or Copilot assistance.');
console.log('Run: grep -r "TODO" ' + targetDir + ' --include="*.ts" | wc -l');
