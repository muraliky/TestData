# Example Configurations

This folder contains example configurations for different scenarios.

## Example 1: Full Paths (Different Drives/Locations)

**config-full-paths.json** - Source and target on completely different locations

```json
{
  "source": {
    "rootDir": "C:/Projects/Legacy/selenium-automation",
    "pages": { "path": "src/test/java/com/company/pages" },
    "steps": { "path": "src/test/java/com/company/steps" },
    "features": { "path": "src/test/resources/features" }
  },
  "target": {
    "rootDir": "D:/NewProjects/playwright-automation",
    "pages": "src/pages",
    "steps": "src/steps",
    "features": "features",
    "fixtures": "src/steps/fixtures.ts"
  }
}
```

## Example 2: Network/Shared Drive

```json
{
  "source": {
    "rootDir": "//network-drive/shared/qa/selenium-tests",
    "pages": { "path": "src/test/java/com/company/pages" },
    "steps": { "path": "src/test/java/com/company/steps" },
    "features": { "path": "features" }
  },
  "target": {
    "rootDir": "C:/Users/myuser/playwright-project",
    "pages": "src/pages",
    "steps": "src/steps",
    "features": "features",
    "fixtures": "src/steps/fixtures.ts"
  }
}
```

## Example 3: Linux/Mac Full Paths

```json
{
  "source": {
    "rootDir": "/home/user/projects/legacy-automation",
    "pages": { "path": "src/test/java/com/company/pages" },
    "steps": { "path": "src/test/java/com/company/steps" },
    "features": { "path": "src/test/resources/features" }
  },
  "target": {
    "rootDir": "/home/user/projects/new-playwright",
    "pages": "src/pages",
    "steps": "src/steps",
    "features": "features",
    "fixtures": "src/steps/fixtures.ts"
  }
}
```

## Example 4: Relative Paths (Same Parent Folder)

```json
{
  "source": {
    "rootDir": "../selenium-repo",
    "pages": { "path": "src/test/java/com/company/pages" },
    "steps": { "path": "src/test/java/com/company/steps" },
    "features": { "path": "features" }
  },
  "target": {
    "rootDir": "./playwright-automation",
    "pages": "src/pages",
    "steps": "src/steps",
    "features": "features",
    "fixtures": "src/steps/fixtures.ts"
  }
}
```

## Example 5: Multiple Repositories

You can create separate config files for each repo:

**repo1-config.json:**
```json
{
  "source": {
    "rootDir": "C:/Projects/repo1-selenium",
    ...
  },
  "target": {
    "rootDir": "C:/Projects/repo1-playwright",
    ...
  }
}
```

**repo2-config.json:**
```json
{
  "source": {
    "rootDir": "C:/Projects/repo2-selenium",
    ...
  },
  "target": {
    "rootDir": "C:/Projects/repo2-playwright",
    ...
  }
}
```

Then run:
```bash
node migrate.js all --config repo1-config.json
node migrate.js all --config repo2-config.json
```
