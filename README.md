# Selenium to Playwright Migration Toolkit

A universal toolkit to migrate **any** Selenium + Java + BDD repository to Playwright + TypeScript + playwright-bdd.

## 🎯 Supported Source Frameworks

This toolkit works with repositories using:

| Framework | Supported |
|-----------|-----------|
| Selenium WebDriver | ✅ |
| QMetry Automation Framework (QAF) | ✅ |
| Cucumber BDD | ✅ |
| TestNG | ✅ |
| JUnit | ✅ |
| Page Object Model | ✅ |
| Any Java + BDD project | ✅ |

## 📦 What's Included

```
migration-toolkit/
├── migrate.js                 # Main migration runner
├── migration-config.json      # Configuration template
├── scripts/
│   ├── 01-setup-project.js    # Creates Playwright project
│   ├── 02-convert-features.js # Converts feature files
│   ├── 03-generate-pages.js   # Generates page classes
│   ├── 04-generate-steps.js   # Generates step definitions
│   ├── 05-generate-fixtures.js# Generates fixtures.ts
│   └── 06-migration-report.js # Migration status report
└── README.md
```

## 🚀 Quick Start

### Step 1: Initialize Configuration

```bash
node migrate.js init
```

This creates `migration-config.json` with sample configuration.

### Step 2: Configure Your Paths

Edit `migration-config.json` to match your repository structure:

```json
{
  "source": {
    "rootDir": "../my-selenium-repo",
    "pages": {
      "path": "src/test/java/com/mycompany/pages"
    },
    "steps": {
      "path": "src/test/java/com/mycompany/steps"
    },
    "features": {
      "path": "src/test/resources/features"
    }
  },
  "target": {
    "rootDir": "./playwright-automation"
  }
}
```

### Step 3: Run Migration

```bash
# Run complete migration
node migrate.js all

# Or run specific steps
node migrate.js setup      # Create project structure
node migrate.js features   # Convert feature files
node migrate.js pages      # Generate page classes
node migrate.js steps      # Generate step definitions
node migrate.js fixtures   # Generate fixtures.ts
node migrate.js report     # Check migration status
```

### Step 4: Review and Refine

```bash
cd playwright-automation
npm install
npx playwright install

# Review generated files, fix TODOs
# Use GitHub Copilot to help with complex conversions

npx bddgen
npm test
```

## 📁 Common Repository Structures

### Structure A: Standard Maven/Gradle
```
my-repo/
├── src/test/java/com/company/
│   ├── pages/
│   │   ├── LoginPage.java
│   │   └── HomePage.java
│   └── steps/
│       └── LoginSteps.java
└── src/test/resources/
    └── features/
        └── login.feature
```

**Config:**
```json
{
  "source": {
    "rootDir": "../my-repo",
    "pages": { "path": "src/test/java/com/company/pages" },
    "steps": { "path": "src/test/java/com/company/steps" },
    "features": { "path": "src/test/resources/features" }
  }
}
```

### Structure B: QAF Style
```
my-repo/
├── src/test/java/com/company/automation/web/
│   ├── pages/
│   │   ├── accounts/
│   │   │   └── AccountsPage.java
│   │   └── admin/
│   │       └── AdminPage.java
│   └── steps/
│       ├── accounts/
│       │   └── AccountSteps.java
│       └── admin/
│           └── AdminSteps.java
└── scenarios/test/
    ├── smoke/
    │   └── smoke.feature
    └── integration/
        └── accounts/
            └── accounts.feature
```

**Config:**
```json
{
  "source": {
    "rootDir": "../my-repo",
    "pages": { "path": "src/test/java/com/company/automation/web/pages" },
    "steps": { "path": "src/test/java/com/company/automation/web/steps" },
    "features": { "path": "scenarios/test" }
  }
}
```

### Structure C: Simple Structure
```
my-repo/
├── src/
│   ├── pages/
│   │   └── LoginPage.java
│   └── steps/
│       └── LoginSteps.java
└── features/
    └── login.feature
```

**Config:**
```json
{
  "source": {
    "rootDir": "../my-repo",
    "pages": { "path": "src/pages" },
    "steps": { "path": "src/steps" },
    "features": { "path": "features" }
  }
}
```

## ⚙️ Configuration Options

### Full Configuration Reference

```json
{
  "projectName": "playwright-automation",
  "description": "My migrated project",
  
  "source": {
    "rootDir": "../source-repo",
    "pages": {
      "path": "src/test/java/com/company/pages"
    },
    "steps": {
      "path": "src/test/java/com/company/steps"
    },
    "features": {
      "path": "src/test/resources/features"
    }
  },
  
  "target": {
    "rootDir": "./playwright-automation",
    "pages": "src/pages",
    "steps": "src/steps",
    "features": "features",
    "fixtures": "src/steps/fixtures.ts"
  },
  
  "options": {
    "features": {
      "convertAndBut": true,
      "preserveTags": true,
      "folderMapping": {
        "OldFolderName": "new-folder-name",
        "AccountsAndAggregates": "accounts-and-aggregates"
      }
    },
    "pages": {
      "baseClass": "BasePage",
      "generateAssertions": true,
      "generateNavigation": true
    },
    "steps": {
      "stepAnnotations": ["QAFTestStep", "Given", "When", "Then"],
      "inferStepType": true
    },
    "project": {
      "browsers": ["chromium", "firefox", "webkit"],
      "environments": ["dev", "qa", "staging", "prod"],
      "defaultEnv": "dev",
      "baseUrl": "https://dev.example.com"
    }
  }
}
```

### Folder Mapping

For non-standard folder names, use the `folderMapping` option:

```json
{
  "options": {
    "features": {
      "folderMapping": {
        "e2e.Smoke": "smoke",
        "AccountsandAggregates": "accounts-and-aggregates",
        "AdminUX": "admin-ux",
        "MyCustomFolder": "my-custom-folder"
      }
    }
  }
}
```

## 🔄 What Gets Converted

### Feature Files
- ✅ `And` → `Given`/`When`/`Then` (based on context)
- ✅ `But` → `Given`/`When`/`Then` (based on context)
- ✅ Tags preserved
- ✅ Scenario Outlines preserved
- ✅ Data Tables preserved
- ✅ Folder structure maintained (with kebab-case conversion)

### Page Classes
- ✅ `@FindBy(xpath=...)` → Playwright locators
- ✅ XPath → `getByRole`, `getByLabel`, `getByPlaceholder`, CSS
- ✅ Dynamic locators → Methods returning `Locator`
- ✅ Methods → `async` methods with `Promise<void>`
- ✅ Module folder structure preserved

### Step Definitions
- ✅ `@QAFTestStep` → `Given`/`When`/`Then`
- ✅ `@Given`/`@When`/`@Then` → playwright-bdd format
- ✅ Parameters → TypeScript types
- ✅ Page fixtures inferred from class names
- ✅ Module folder structure preserved

## 📊 Migration Report

After running migration, check the report:

```bash
node migrate.js report
```

Output:
```
═══════════════════════════════════════════════════════════
  MIGRATION STATUS REPORT
═══════════════════════════════════════════════════════════

📁 PAGE CLASSES
────────────────────────────────
Total: 15
Needs Review: 3

📝 STEP DEFINITIONS
────────────────────────────────
Total files: 12
Total steps: 145

🎬 FEATURE FILES
────────────────────────────────
Total: 25
Converted (no And/But): 25

⚠️  ISSUES
────────────────────────────────
  ❌ 3 page file(s) have complex XPath needing manual review

📋 NEXT STEPS
────────────────────────────────
  1. Review files with TODO comments
  2. Run: npm install
  3. Run: npx bddgen
  4. Run: npm test

═══════════════════════════════════════════════════════════
OVERALL PROGRESS: 85%
═══════════════════════════════════════════════════════════
```

## 🤖 Using with GitHub Copilot

After running the migration scripts, use Copilot to refine:

### For Complex XPath Conversions
```
@workspace Look at the TODO comments in src/pages/ that mention XPath.
Help me convert these to Playwright recommended locators following
getByRole > getByLabel > getByPlaceholder > CSS priority.
```

### For Implementing Step Methods
```
@workspace The step definitions in src/steps/ have TODO placeholders.
Help me implement these methods using the corresponding page classes.
```

### For Fixing Test Failures
```
@workspace The test for "user login" is failing. Look at the feature file,
step definition, and page class to help me fix it.
```

## 🛠️ Troubleshooting

### Source directory not found
```
❌ Source directory not found: ../my-repo
```
**Fix:** Update `source.rootDir` in config to the correct path.

### No page classes found
```
Total page classes generated: 0
```
**Fix:** Check `source.pages.path` matches your actual folder structure.

### Feature files still have And/But
```
❌ 5 feature file(s) still have And/But keywords
```
**Fix:** Re-run `node migrate.js features` or manually fix the files.

### XPath not converted
Complex XPath patterns may not auto-convert. Look for `TODO: Review` comments and use Copilot to help convert.

## 📝 Examples

### Example 1: E-commerce Project

```json
{
  "source": {
    "rootDir": "../ecommerce-tests",
    "pages": { "path": "src/test/java/com/shop/pages" },
    "steps": { "path": "src/test/java/com/shop/steps" },
    "features": { "path": "src/test/resources/features" }
  }
}
```

### Example 2: Banking Application

```json
{
  "source": {
    "rootDir": "../banking-automation",
    "pages": { "path": "src/test/java/com/bank/automation/web/pages" },
    "steps": { "path": "src/test/java/com/bank/automation/web/steps" },
    "features": { "path": "scenarios/test" }
  },
  "options": {
    "features": {
      "folderMapping": {
        "AccountsandAggregates": "accounts",
        "TransferFunds": "transfers"
      }
    }
  }
}
```

### Example 3: Multiple Source Locations

If your pages are in multiple locations, run the script multiple times:

```bash
# First location
node migrate.js pages --source "../repo/src/main/pages"

# Second location  
node migrate.js pages --source "../repo/src/test/pages"
```

## 📄 License

MIT License - Feel free to use and modify for your projects.

## 🤝 Contributing

Contributions welcome! Please submit issues and pull requests.
