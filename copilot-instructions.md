# GitHub Copilot Instructions for Playwright Migration

## Project Context

This is a Playwright + TypeScript + playwright-bdd project migrated from Selenium + Java + QAF/Cucumber.

**Source Reference**: The original Java code is available in the workspace under "Selenium (Source - Reference Only)" folder. Use it to understand the original logic when implementing TODO methods.

**Target Project**: This Playwright project under "Playwright (Target)" folder.

---

## CRITICAL RULES

### 1. XPath Conversion (NEVER use XPath in Playwright)

Convert ALL XPath from Java source to Playwright locators using this priority:

| Priority | Playwright Method | Use For |
|----------|------------------|---------|
| 1 | `getByRole()` | Buttons, links, inputs, headings, checkboxes, radio |
| 2 | `getByLabel()` | Form inputs with associated labels |
| 3 | `getByPlaceholder()` | Inputs with placeholder text |
| 4 | `getByText()` | Elements with unique visible text |
| 5 | `getByTestId()` | Elements with data-testid attribute |
| 6 | CSS Selector | When semantic locators don't work |
| 7 | XPath | **NEVER USE** - Always find alternative |

### XPath Conversion Examples

```java
// Java XPath → Playwright
"//button[text()='Submit']"           → page.getByRole('button', { name: 'Submit' })
"//button[contains(text(),'Save')]"   → page.getByRole('button', { name: /Save/i })
"//a[text()='Click Here']"            → page.getByRole('link', { name: 'Click Here' })
"//input[@id='username']"             → page.getByLabel('Username') or page.locator('#username')
"//input[@placeholder='Search']"      → page.getByPlaceholder('Search')
"//label[text()='Email']/../input"    → page.getByLabel('Email')
"//div[@class='error-message']"       → page.locator('.error-message')
"//button[contains(@class,'primary')]"→ page.locator('button.primary')
"(//button[@class='edit'])[1]"        → page.locator('button.edit').first()
"(//button[@class='edit'])[last()]"   → page.locator('button.edit').last()
"//tr[td[text()='John']]"             → page.locator('tr').filter({ hasText: 'John' })
"//table[@id='data']//tr[3]/td[2]"    → page.locator('#data tbody tr:nth-child(3) td:nth-child(2)')
```

### 2. Page Class Pattern

```typescript
import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from '../base.page';

export class ExamplePage extends BasePage {
  // Locators as readonly properties - initialized in constructor
  readonly submitButton: Locator;
  readonly usernameInput: Locator;
  readonly errorMessage: Locator;

  constructor(page: Page) {
    super(page);
    // Use Playwright recommended locators - NO XPATH
    this.submitButton = page.getByRole('button', { name: 'Submit' });
    this.usernameInput = page.getByLabel('Username');
    this.errorMessage = page.locator('.error-message');
  }

  // Dynamic locators - return Locator type
  getRowByName(name: string): Locator {
    return this.page.locator('tr').filter({ hasText: name });
  }

  getButtonInRow(name: string): Locator {
    return this.getRowByName(name).getByRole('button', { name: /edit/i });
  }

  // Actions - async methods with Promise<void>
  async enterUsername(username: string): Promise<void> {
    await this.usernameInput.fill(username);
  }

  async clickSubmit(): Promise<void> {
    await this.submitButton.click();
  }

  // Assertions - use Playwright expect
  async expectErrorMessage(message: string): Promise<void> {
    await expect(this.errorMessage).toBeVisible();
    await expect(this.errorMessage).toContainText(message);
  }
}
```

### 3. Step Definition Pattern

```typescript
import { Given, When, Then, expect } from '../fixtures';

// Use destructured page fixtures
Given('user is on the login page', async ({ loginPage }) => {
  await loginPage.navigate();
});

When('user enters username {string}', async ({ loginPage }, username: string) => {
  await loginPage.enterUsername(username);
});

When('user clicks submit button', async ({ loginPage }) => {
  await loginPage.clickSubmit();
});

Then('user should see error message {string}', async ({ loginPage }, message: string) => {
  await loginPage.expectErrorMessage(message);
});

// Multiple page fixtures when needed
Given('user is logged in and on dashboard', async ({ loginPage, dashboardPage }) => {
  await loginPage.navigate();
  await loginPage.loginWithDefaultCredentials();
  await dashboardPage.expectVisible();
});
```

### 4. Converting Java Methods to TypeScript

**Java Pattern:**
```java
public void searchAccount(String term) {
    searchInput.clear();
    searchInput.sendKeys(term);
    searchButton.click();
    waitForSpinnerToDisappear();
}
```

**TypeScript Pattern:**
```typescript
async searchAccount(term: string): Promise<void> {
  await this.searchInput.clear();
  await this.searchInput.fill(term);  // fill() instead of sendKeys()
  await this.searchButton.click();
  await this.loadingSpinner.waitFor({ state: 'hidden' });
}
```

### 5. Converting Java Assertions

**Java:**
```java
Assert.assertTrue(element.isDisplayed());
Assert.assertEquals(element.getText(), "Expected");
Assert.assertTrue(elements.size() > 0);
```

**TypeScript:**
```typescript
await expect(element).toBeVisible();
await expect(element).toHaveText('Expected');
await expect(elements).toHaveCount(expect.any(Number));
// or
expect(await elements.count()).toBeGreaterThan(0);
```

### 6. Common Playwright Equivalents

| Selenium/Java | Playwright/TypeScript |
|--------------|----------------------|
| `element.click()` | `await element.click()` |
| `element.sendKeys(text)` | `await element.fill(text)` |
| `element.clear()` | `await element.clear()` |
| `element.getText()` | `await element.innerText()` |
| `element.getAttribute(name)` | `await element.getAttribute(name)` |
| `element.isDisplayed()` | `await element.isVisible()` |
| `element.isEnabled()` | `await element.isEnabled()` |
| `new Select(el).selectByVisibleText(t)` | `await element.selectOption({ label: t })` |
| `driver.navigate().to(url)` | `await page.goto(url)` |
| `driver.findElements(...)` | `page.locator(...).all()` or `.count()` |
| `WebDriverWait` | `await element.waitFor()` or `await page.waitForSelector()` |
| `Thread.sleep(ms)` | `await page.waitForTimeout(ms)` (avoid if possible) |

### 7. Feature File Rules (playwright-bdd)

**CRITICAL: playwright-bdd does NOT support And/But keywords**

If you see And/But in feature files, they must be converted:
- `And` after `Given` → `Given`
- `And` after `When` → `When`  
- `And` after `Then` → `Then`
- `But` follows same rules

---

## How to Implement TODO Methods

When you see a TODO comment like:
```typescript
async searchAccount(term: string): Promise<void> {
  // TODO: Implement - Original method: searchAccount
  throw new Error('Not implemented');
}
```

1. Find the corresponding Java method in the source folder
2. Understand the logic
3. Convert to Playwright patterns:
   - Add `await` before all async operations
   - Convert XPath to Playwright locators
   - Use Playwright assertions instead of Assert
   - Return `Promise<void>` for action methods

---

## Reference Files

- **Base Page**: `src/pages/base.page.ts` - Common utilities
- **Fixtures**: `src/steps/fixtures.ts` - Page fixtures and BDD setup
- **Common Steps**: `src/steps/common.steps.ts` - Reusable step definitions
