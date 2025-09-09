# Language Management Documentation

## Overview
This document provides a comprehensive guide to managing languages (i18n) in the Materialize Next.js Admin Template, based on the [official translation documentation](https://demos.pixinvent.com/materialize-nextjs-admin-template/documentation/docs/guide/development/translation/add-language).

## What is i18n (Internationalization)?

Internationalization (i18n) is the process of designing and developing applications to support multiple languages and regions. The Materialize template supports multiple languages through:

- **Locale files** - JSON files containing translations
- **Configuration** - i18n settings and language directions
- **Routing** - Language-specific URL routing
- **Redirects** - Automatic language detection and redirection

## Current Project Status

### Starter Kit Configuration
The Materialize starter kit **does not include i18n by default**. The current project structure shows:

```
src/data/
└── navigation/
    ├── horizontalMenuData.tsx
    └── verticalMenuData.tsx
```

**No i18n files found:**
- ❌ `src/configs/i18n.ts` - Not present
- ❌ `src/data/dictionaries/` - Directory doesn't exist
- ❌ `src/utils/getDictionary.ts` - Not present

### Adding i18n to Starter Kit
If you need internationalization support, you'll need to add it manually following the [Adding i18n to Starter-Kit guide](https://demos.pixinvent.com/materialize-nextjs-admin-template/documentation/docs/guide/development/translation/adding-i18n-to-starter-kit).

## Language Management Procedures

### 1. Adding a New Language

Based on the [official guide](https://demos.pixinvent.com/materialize-nextjs-admin-template/documentation/docs/guide/development/translation/add-language):

#### Step 1: Add the Locale File
Create a JSON file for the new language in the `src/data/dictionaries` folder.

**Example: Adding German (`de.json`)**
```json
{
  "navigation": {
    "home": "Heim",
    "about": "Zirka"
  }
}
```

#### Step 2: Update Configuration
Modify `src/configs/i18n.ts` to include the new language:

```typescript
export const i18n = {
  defaultLocale: 'en',
  locales: ['en', 'de'], // Add 'de' for German
  langDirection: {
    en: 'ltr',
    de: 'ltr' // Add direction for German
  }
} as const
```

#### Step 3: Add Imports and Redirects

**Update `src/utils/getDictionary.ts`:**
```typescript
const dictionaries = {
  en: () => import('@/data/dictionaries/en.json').then(module => module.default),
  de: () => import('@/data/dictionaries/de.json').then(module => module.default) // Add German import
}
```

**Update `next.config.mjs` redirects:**
```javascript
redirects: async () => {
  return [
    {
      source: '/:lang(en|de)',
      destination: '/:lang/dashboards/crm',
      permanent: false
    },
    {
      source: '/((?!(?:en|de)\\b)):path',
      destination: '/en/:path',
      permanent: false
    }
  ]
}
```

#### Step 4: Clear Browser Cache
1. Delete the `.next` folder
2. Restart the development server
3. Clear browser cache or test in Guest Mode

### 2. Changing Default Language

Based on the [official guide](https://demos.pixinvent.com/materialize-nextjs-admin-template/documentation/docs/guide/development/translation/change-default-language):

#### Step 1: Update defaultLocale
Modify `src/configs/i18n.ts`:

```typescript
export const i18n = {
  defaultLocale: 'de', // Set German as the default language
  locales: ['en', 'de'],
  langDirection: {
    en: 'ltr',
    de: 'ltr'
  }
} as const
```

#### Step 2: Update Redirects
Adjust `next.config.mjs` redirects:

```javascript
redirects: async () => {
  return [
    {
      source: '/',
      destination: '/de/dashboards/crm',
      permanent: false
    },
    {
      source: '/:lang(en|de)',
      destination: '/:lang/dashboards/crm',
      permanent: false
    },
    {
      source: '/((?!(?:en|de)\\b)):path',
      destination: '/de/:path',
      permanent: true,
      locale: false
    }
  ]
}
```

#### Step 3: Clear Browser Cache
1. Delete the `.next` folder
2. Restart the development server
3. Clear browser cache or test in Guest Mode

### 3. Removing a Language

Based on the [official guide](https://demos.pixinvent.com/materialize-nextjs-admin-template/documentation/docs/guide/development/translation/remove-language):

#### Step 1: Remove the Locale File
Delete the JSON file from `src/data/dictionaries` folder.

**Example: Removing German**
```bash
rm src/data/dictionaries/de.json
```

#### Step 2: Update Configuration
In `src/configs/i18n.ts`, remove the language:

```typescript
export const i18n = {
  defaultLocale: 'en',
  locales: ['en'], // Remove 'de'
  langDirection: {
    en: 'ltr'
    // Remove 'de' entry
  }
} as const
```

#### Step 3: Additional Modifications

**Update `src/utils/getDictionary.ts`:**
```typescript
const dictionaries = {
  en: () => import('@/data/dictionaries/en.json').then(module => module.default)
  // Remove German import
}
```

**Update `next.config.mjs` redirects:**
```javascript
redirects: async () => {
  return [
    {
      source: '/:lang(en)', // Remove 'de' from pattern
      destination: '/:lang/dashboards/crm',
      permanent: false
    },
    {
      source: '/((?!(?:en)\\b)):path', // Remove 'de' from pattern
      destination: '/en/:path',
      permanent: false
    }
  ]
}
```

#### Step 4: Clear Browser Cache
1. Delete the `.next` folder
2. Restart the development server
3. Clear browser cache or test in Guest Mode

## Common Language Codes

### European Languages
- `en` - English
- `de` - German
- `fr` - French
- `es` - Spanish
- `it` - Italian
- `pt` - Portuguese
- `nl` - Dutch
- `sv` - Swedish
- `no` - Norwegian
- `da` - Danish

### Asian Languages
- `zh` - Chinese
- `ja` - Japanese
- `ko` - Korean
- `th` - Thai
- `vi` - Vietnamese

### Middle Eastern Languages
- `ar` - Arabic (RTL)
- `he` - Hebrew (RTL)
- `fa` - Persian/Farsi (RTL)

## Language Direction Support

### Left-to-Right (LTR) Languages
Most languages use LTR direction:
```typescript
langDirection: {
  en: 'ltr',
  de: 'ltr',
  fr: 'ltr',
  es: 'ltr'
}
```

### Right-to-Left (RTL) Languages
Arabic, Hebrew, and Persian use RTL direction:
```typescript
langDirection: {
  en: 'ltr',
  ar: 'rtl',
  he: 'rtl',
  fa: 'rtl'
}
```

## Best Practices

### 1. Translation File Structure
Organize translations logically:
```json
{
  "navigation": {
    "home": "Home",
    "about": "About",
    "contact": "Contact"
  },
  "common": {
    "save": "Save",
    "cancel": "Cancel",
    "delete": "Delete"
  },
  "pages": {
    "dashboard": {
      "title": "Dashboard",
      "welcome": "Welcome to Dashboard"
    }
  }
}
```

### 2. Consistent Naming
- Use consistent language codes (ISO 639-1)
- Keep translation keys descriptive
- Use nested objects for organization

### 3. Testing
- Test all language switches
- Verify RTL layout for RTL languages
- Check all routes work with different languages
- Test language detection and fallbacks

## Troubleshooting

### Issue: Language Not Loading
**Symptoms**: Default language shows instead of selected language
**Solutions**:
1. Check locale file exists in `src/data/dictionaries/`
2. Verify import in `getDictionary.ts`
3. Ensure language is in `locales` array
4. Clear browser cache

### Issue: Redirects Not Working
**Symptoms**: Language-specific URLs don't redirect properly
**Solutions**:
1. Check `next.config.mjs` redirects
2. Verify language patterns in redirect rules
3. Restart development server
4. Clear `.next` folder

### Issue: RTL Layout Issues
**Symptoms**: RTL languages don't display correctly
**Solutions**:
1. Verify `langDirection` configuration
2. Check CSS RTL support
3. Test with different RTL languages
4. Verify browser RTL support

## Implementation Checklist

### Adding a New Language
- [ ] Create locale JSON file
- [ ] Update `i18n.ts` configuration
- [ ] Add import to `getDictionary.ts`
- [ ] Update `next.config.mjs` redirects
- [ ] Clear browser cache
- [ ] Test language switching

### Changing Default Language
- [ ] Update `defaultLocale` in `i18n.ts`
- [ ] Update root redirect in `next.config.mjs`
- [ ] Update fallback redirects
- [ ] Clear browser cache
- [ ] Test default language behavior

### Removing a Language
- [ ] Delete locale JSON file
- [ ] Remove from `locales` array
- [ ] Remove from `langDirection`
- [ ] Remove import from `getDictionary.ts`
- [ ] Update redirect patterns
- [ ] Clear browser cache
- [ ] Test remaining languages

## Related Documentation

- [Adding i18n to Starter-Kit](https://demos.pixinvent.com/materialize-nextjs-admin-template/documentation/docs/guide/development/translation/adding-i18n-to-starter-kit)
- [Adding a new language](https://demos.pixinvent.com/materialize-nextjs-admin-template/documentation/docs/guide/development/translation/add-language)
- [Change default language](https://demos.pixinvent.com/materialize-nextjs-admin-template/documentation/docs/guide/development/translation/change-default-language)
- [Removing a language](https://demos.pixinvent.com/materialize-nextjs-admin-template/documentation/docs/guide/development/translation/remove-language)
- [RTL Support](./FOLDER_STRUCTURE.md#rtl-support)

---
**Sources**: 
- [Materialize Translation Documentation](https://demos.pixinvent.com/materialize-nextjs-admin-template/documentation/docs/guide/development/translation/add-language)
- [Change Default Language](https://demos.pixinvent.com/materialize-nextjs-admin-template/documentation/docs/guide/development/translation/change-default-language)
- [Remove Language](https://demos.pixinvent.com/materialize-nextjs-admin-template/documentation/docs/guide/development/translation/remove-language)
**Last Updated**: December 2024
**Template Version**: Materialize Next.js Admin Template v5.0.0
<｜tool▁calls▁begin｜><｜tool▁call▁begin｜>
read_file
