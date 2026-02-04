# Copilot Prompts Cheat Sheet

Copy-paste these prompts into GitHub Copilot Chat. Replace paths as needed.

---

## 🔧 Implementing Page Class TODOs

### Prompt: Implement All TODOs in Current File
```
@workspace This file has TODO comments that need implementation.
Find the corresponding Java source file in the "Selenium (Source - Reference Only)" folder.
Implement all TODO methods following these rules:
1. Convert XPath to Playwright locators (getByRole, getByLabel, getByPlaceholder, CSS)
2. Use async/await pattern
3. Use Playwright expect for assertions
Reference the copilot-instructions.md for patterns.
```

### Prompt: Implement Specific Page Class
```
@workspace Implement the TODO methods in:
src/pages/accounts/accounts.page.ts

Reference the original Java file:
Selenium (Source - Reference Only)/src/test/java/com/company/pages/accounts/AccountsPage.java

Convert all XPath to Playwright recommended locators. Follow patterns in copilot-instructions.md.
```

### Prompt: Convert Specific XPath Locators
```
@workspace Look at the TODO comments in this file that mention XPath.
Convert each XPath to the best Playwright locator using this priority:
1. getByRole() for buttons, links, inputs
2. getByLabel() for labeled form fields
3. getByPlaceholder() for inputs with placeholder
4. CSS selectors as fallback
Never use XPath in the final code.
```

---

## 📝 Implementing Step Definition TODOs

### Prompt: Implement Step Definition File
```
@workspace Implement the TODO methods in:
src/steps/accounts/accounts.steps.ts

Reference the original Java file:
Selenium (Source - Reference Only)/src/test/java/com/company/steps/accounts/AccountSteps.java

Use the page fixtures from fixtures.ts. Follow playwright-bdd patterns.
```

### Prompt: Create Missing Step Definitions
```
@workspace Read the feature file at:
features/integration/accounts/accounts.feature

Check which steps are missing in:
src/steps/accounts/accounts.steps.ts

Create the missing step definitions using the accountsPage fixture.
```

---

## 🔍 Comparing Source and Target

### Prompt: Show Differences
```
@workspace Compare these files and show what's missing in the target:

Source (Java): Selenium (Source - Reference Only)/src/test/java/com/company/pages/LoginPage.java
Target (TypeScript): Playwright (Target)/src/pages/login/login.page.ts

List any methods or locators that exist in Java but are missing or incomplete in TypeScript.
```

### Prompt: Complete Target Based on Source
```
@workspace The target file is incomplete. Complete it based on the source:

Source: Selenium (Source - Reference Only)/src/test/java/com/company/pages/OrdersPage.java
Target: Playwright (Target)/src/pages/orders/orders.page.ts

Add missing locators and implement missing methods. Convert all XPath.
```

---

## 🚀 Batch Operations

### Prompt: List All Files with TODOs
```
@workspace Find all TypeScript files in src/pages/ and src/steps/ that contain "TODO" comments.
List them with the count of TODOs in each file.
```

### Prompt: Implement All Page Classes in a Module
```
@workspace Implement all TODO methods in the accounts module:
- src/pages/accounts/accounts.page.ts
- src/pages/accounts/account-details.page.ts
- src/pages/accounts/account-aggregates.page.ts

Reference the corresponding Java files in:
Selenium (Source - Reference Only)/src/test/java/com/company/pages/accounts/

Follow Playwright patterns from copilot-instructions.md.
```

---

## 🐛 Fixing Issues

### Prompt: Fix Compilation Errors
```
@workspace This file has TypeScript compilation errors. Fix them following Playwright patterns:
- Ensure all methods are async and return Promise<void>
- Ensure locators are properly typed as Locator
- Fix any import issues
```

### Prompt: Fix Locator Not Found
```
@workspace The test is failing because a locator is not finding the element.
Current locator: page.locator('#oldId')

Suggest alternative Playwright locators that might work better.
Consider getByRole, getByLabel, getByText, or a more specific CSS selector.
```

### Prompt: Fix Step Definition Mismatch
```
@workspace The test is failing because step definition doesn't match feature file.

Feature step: "When user enters username "testuser" and password "pass123""
Current step def: When('user enters username {string}', ...)

Fix the step definition to match the feature file exactly.
```

---

## 📊 Review and Validation

### Prompt: Review Converted Page Class
```
@workspace Review this converted page class for best practices:
src/pages/accounts/accounts.page.ts

Check:
1. Are all locators using Playwright recommended methods?
2. Is there any XPath that should be converted?
3. Are assertions using Playwright expect?
4. Is the code following TypeScript best practices?

Suggest improvements.
```

### Prompt: Validate Feature File Conversion
```
@workspace Check this feature file for playwright-bdd compatibility:
features/integration/accounts/accounts.feature

1. Are there any remaining "And" or "But" keywords?
2. Do all steps have matching step definitions?
3. Are tags properly formatted?
```

---

## 💡 Tips for Effective Prompts

1. **Always reference both folders** - Copilot needs to know where source and target are

2. **Be specific about file paths** - Use exact paths when possible

3. **Reference the instructions file** - Mention copilot-instructions.md for consistent patterns

4. **One task at a time** - Break complex tasks into smaller prompts

5. **Use @workspace** - This tells Copilot to search across all workspace folders
