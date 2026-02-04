# Using GitHub Copilot with Separate Source & Target Paths

When your source (Selenium) and target (Playwright) repositories are in different locations, you need to set up a **VS Code Multi-Root Workspace** so Copilot can access both.

---

## Step 1: Create VS Code Workspace

### Option A: Using VS Code UI

1. Open VS Code
2. Go to **File → Add Folder to Workspace**
3. Add your Playwright project folder (target)
4. Go to **File → Add Folder to Workspace** again
5. Add your Selenium project folder (source)
6. Go to **File → Save Workspace As**
7. Save as `migration-workspace.code-workspace`

### Option B: Create Workspace File Manually

Create a file `migration-workspace.code-workspace`:

```json
{
  "folders": [
    {
      "name": "Playwright (Target)",
      "path": "C:/Projects/playwright-automation"
    },
    {
      "name": "Selenium (Source - Reference Only)",
      "path": "C:/Projects/selenium-repo"
    }
  ],
  "settings": {
    "github.copilot.enable": {
      "*": true
    }
  }
}
```

Then double-click this file to open both folders in VS Code.

---

## Step 2: Add Copilot Instructions to Playwright Project

Create `.github/copilot-instructions.md` in your **Playwright project** (target):

```
playwright-automation/
├── .github/
│   └── copilot-instructions.md    ← Create this
├── src/
│   ├── pages/
│   └── steps/
└── features/
```

---

## Step 3: Use These Copilot Prompts

### Prompt 1: Implement Page Class Methods

When you have a page class with TODO comments:

```
@workspace Look at the Java source file at:
"Selenium (Source - Reference Only)/src/test/java/com/company/pages/accounts/AccountsPage.java"

Now implement the TODO methods in:
"Playwright (Target)/src/pages/accounts/accounts.page.ts"

Follow the Playwright patterns in copilot-instructions.md.
Convert any XPath to Playwright locators using getByRole, getByLabel, getByPlaceholder.
```

### Prompt 2: Implement Step Definitions

```
@workspace Reference the Java step definitions at:
"Selenium (Source - Reference Only)/src/test/java/com/company/steps/accounts/AccountSteps.java"

Implement the TODO methods in:
"Playwright (Target)/src/steps/accounts/accounts.steps.ts"

Use async/await and the page fixtures from fixtures.ts.
```

### Prompt 3: Batch Implement All TODOs in a File

Open the TypeScript file with TODOs, then:

```
@workspace This file has TODO placeholders. 
Find the corresponding Java source file in "Selenium (Source - Reference Only)" folder.
Implement all the TODO methods following the Playwright patterns.
Convert XPath to recommended Playwright locators.
```

### Prompt 4: Compare and Complete

```
@workspace Compare these two files:
- Source: Selenium (Source - Reference Only)/src/test/java/com/company/pages/LoginPage.java
- Target: Playwright (Target)/src/pages/login/login.page.ts

The target has TODO comments. Implement them based on the Java source logic.
```

---

## Step 4: Copilot Instructions File

Here's the complete `.github/copilot-instructions.md` to put in your Playwright project:

