#!/usr/bin/env node
/**
 * ============================================================
 * SELENIUM TO PLAYWRIGHT MIGRATION TOOLKIT
 * ============================================================
 * 
 * A universal toolkit to migrate any Selenium + Java + BDD
 * repository to Playwright + TypeScript + playwright-bdd
 * 
 * Usage:
 *   node migrate.js                    # Run with migration-config.json
 *   node migrate.js --config my.json   # Run with custom config
 *   node migrate.js --init             # Create sample config file
 *   node migrate.js --help             # Show help
 * 
 * Steps:
 *   node migrate.js setup              # Setup Playwright project
 *   node migrate.js features           # Convert feature files
 *   node migrate.js pages              # Generate page classes
 *   node migrate.js steps              # Generate step definitions
 *   node migrate.js fixtures           # Generate fixtures.ts
 *   node migrate.js report             # Generate migration report
 *   node migrate.js all                # Run all steps
 */

const fs = require('fs');
const path = require('path');

// Parse command line arguments
const args = process.argv.slice(2);
let configPath = 'migration-config.json';
let command = 'all';

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--config' && args[i + 1]) {
    configPath = args[i + 1];
    i++;
  } else if (args[i] === '--init') {
    command = 'init';
  } else if (args[i] === '--help' || args[i] === '-h') {
    command = 'help';
  } else if (!args[i].startsWith('-')) {
    command = args[i];
  }
}

// Help text
function showHelp() {
  console.log(`
╔══════════════════════════════════════════════════════════════╗
║     SELENIUM TO PLAYWRIGHT MIGRATION TOOLKIT                 ║
╚══════════════════════════════════════════════════════════════╝

USAGE:
  node migrate.js [command] [options]

COMMANDS:
  all         Run complete migration (default)
  setup       Create Playwright project structure
  features    Convert feature files (And/But → Given/When/Then)
  pages       Generate TypeScript page classes from Java
  steps       Generate TypeScript step definitions from Java
  fixtures    Generate fixtures.ts with all page imports
  report      Generate migration status report
  init        Create sample configuration file

OPTIONS:
  --config <path>   Use custom config file (default: migration-config.json)
  --help, -h        Show this help message

EXAMPLES:
  # Initialize with sample config
  node migrate.js init
  
  # Edit migration-config.json with your paths
  
  # Run complete migration
  node migrate.js all
  
  # Run specific step
  node migrate.js features
  
  # Use custom config
  node migrate.js all --config my-project-config.json

TYPICAL WORKFLOW:
  1. node migrate.js init              # Create config
  2. Edit migration-config.json        # Set your paths
  3. node migrate.js all               # Run migration
  4. node migrate.js report            # Check status
  5. Review and refine with Copilot    # Fix TODOs
  6. npm install && npm test           # Verify
`);
}

// Initialize sample config
function initConfig() {
  const sampleConfig = {
    projectName: "playwright-automation",
    description: "Migrated from Selenium BDD",
    
    source: {
      rootDir: "/full/path/to/your-selenium-repo",
      pages: {
        path: "src/test/java/com/company/pages"
      },
      steps: {
        path: "src/test/java/com/company/steps"
      },
      features: {
        path: "src/test/resources/features"
      }
    },
    
    target: {
      rootDir: "/full/path/to/playwright-automation",
      pages: "src/pages",
      steps: "src/steps",
      features: "features",
      fixtures: "src/steps/fixtures.ts"
    },
    
    options: {
      features: {
        convertAndBut: true,
        preserveTags: true,
        folderMapping: {}
      },
      project: {
        browsers: ["chromium", "firefox"],
        environments: ["dev", "qa", "staging"],
        defaultEnv: "dev",
        baseUrl: "https://example.com"
      }
    }
  };
  
  fs.writeFileSync('migration-config.json', JSON.stringify(sampleConfig, null, 2));
  console.log('\n[SUCCESS] Created migration-config.json');
  console.log('\nIMPORTANT: Edit migration-config.json with your actual paths:');
  console.log('  - source.rootDir: Full path to your Selenium repository');
  console.log('  - source.pages.path: Relative path to Java page classes');
  console.log('  - source.steps.path: Relative path to Java step definitions');
  console.log('  - source.features.path: Relative path to feature files');
  console.log('  - target.rootDir: Full path where Playwright project will be created');
  console.log('\nThen run: node migrate.js all');
}

// Load configuration
function loadConfig() {
  if (!fs.existsSync(configPath)) {
    console.error(`❌ Config file not found: ${configPath}`);
    console.log('\nRun "node migrate.js init" to create a sample config file');
    process.exit(1);
  }
  
  try {
    const content = fs.readFileSync(configPath, 'utf8');
    // Remove comments (lines starting with "//")
    const cleanContent = content.replace(/"\/\/.*":\s*"[^"]*",?\n/g, '');
    return JSON.parse(cleanContent);
  } catch (err) {
    console.error(`❌ Error parsing config: ${err.message}`);
    process.exit(1);
  }
}

// Resolve source path
function resolveSourcePath(config, type) {
  const rootDir = config.source.rootDir;
  const typePath = config.source[type].path;
  return path.join(rootDir, typePath);
}

// Resolve target path
function resolveTargetPath(config, type) {
  const rootDir = config.target.rootDir;
  const typePath = config.target[type];
  return path.join(rootDir, typePath);
}

// Print banner
function printBanner(text) {
  console.log('\n' + '═'.repeat(60));
  console.log(`  ${text}`);
  console.log('═'.repeat(60) + '\n');
}

// Load and run a script
function runScript(scriptName, configFile) {
  const scriptPath = path.join(__dirname, 'scripts', scriptName);
  if (!fs.existsSync(scriptPath)) {
    console.error('[ERROR] Script not found: ' + scriptPath);
    return false;
  }
  
  try {
    // Clear require cache to allow re-running
    delete require.cache[require.resolve(scriptPath)];
    
    // Set up argv for the script - pass config path
    const originalArgv = process.argv;
    process.argv = ['node', scriptPath, configFile];
    
    require(scriptPath);
    
    process.argv = originalArgv;
    return true;
  } catch (err) {
    console.error('[ERROR] Error running ' + scriptName + ': ' + err.message);
    return false;
  }
}

// Main execution
async function main() {
  console.log('='.repeat(60));
  console.log('  SELENIUM TO PLAYWRIGHT MIGRATION TOOLKIT');
  console.log('  Version 1.0.0');
  console.log('='.repeat(60));
  
  if (command === 'help') {
    showHelp();
    return;
  }
  
  if (command === 'init') {
    initConfig();
    return;
  }
  
  // Load config for other commands
  const config = loadConfig();
  
  console.log('\n[INFO] Configuration: ' + configPath);
  console.log('[INFO] Source: ' + config.source.rootDir);
  console.log('[INFO] Target: ' + config.target.rootDir);
  console.log('[INFO] Command: ' + command);
  
  // Verify source exists
  if (!fs.existsSync(config.source.rootDir)) {
    console.log('\n[ERROR] Source directory not found: ' + config.source.rootDir);
    console.log('  Please update source.rootDir in your config file');
    process.exit(1);
  }
  
  const commands = {
    setup: () => {
      printBanner('STEP 1: Setting up Playwright Project');
      return runScript('01-setup-project.js', configPath);
    },
    
    features: () => {
      printBanner('STEP 2: Converting Feature Files');
      return runScript('02-convert-features.js', configPath);
    },
    
    pages: () => {
      printBanner('STEP 3: Generating Page Classes');
      return runScript('03-generate-pages.js', configPath);
    },
    
    steps: () => {
      printBanner('STEP 4: Generating Step Definitions');
      return runScript('04-generate-steps.js', configPath);
    },
    
    fixtures: () => {
      printBanner('STEP 5: Generating Fixtures');
      return runScript('05-generate-fixtures.js', configPath);
    },
    
    report: () => {
      printBanner('STEP 6: Migration Report');
      return runScript('06-migration-report.js', configPath);
    },
    
    all: () => {
      const steps = ['setup', 'features', 'pages', 'steps', 'fixtures', 'report'];
      for (const step of steps) {
        if (!commands[step]()) {
          console.error('\n[ERROR] Migration failed at step: ' + step);
          return false;
        }
      }
      return true;
    }
  };
  
  if (!commands[command]) {
    console.error(`❌ Unknown command: ${command}`);
    console.log('\nRun "node migrate.js --help" for available commands');
    process.exit(1);
  }
  
  const success = commands[command]();
  
  if (success && command === 'all') {
    console.log('\n' + '='.repeat(60));
    console.log('  MIGRATION COMPLETE');
    console.log('='.repeat(60));
    console.log('\nTarget project: ' + config.target.rootDir);
    console.log('\nNext steps:');
    console.log('  1. cd ' + config.target.rootDir);
    console.log('  2. npm install');
    console.log('  3. npx playwright install');
    console.log('  4. Review files marked with TODO');
    console.log('  5. Use GitHub Copilot to refine conversions');
    console.log('  6. npx bddgen && npm test');
  }
}

main().catch(console.error);
