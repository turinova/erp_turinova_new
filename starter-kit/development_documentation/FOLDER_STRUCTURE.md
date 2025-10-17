# Materialize Folder Structure Documentation

## Overview
This document provides a comprehensive guide to the Materialize Next.js Admin Template folder structure, based on the [official documentation](https://demos.pixinvent.com/materialize-nextjs-admin-template/documentation/docs/guide/development/folder-structure).

## ⚠️ Important Warnings

### DO NOT MODIFY These Core Folders:
- `src/@core` - Core template functionality
- `src/@layouts` - Layout components
- `src/@menu` - Menu system components

**These folders receive updates with each new release and unauthorized changes could disrupt your project.**

## Complete Folder Structure

```
.
├── public                              -> Stores assets like images, accessible by the web server
├── src
│   ├── @core                           -> Template's core files (DO NOT MODIFY)
│   ├── @layouts                        -> Template's layout files (DO NOT MODIFY)
│   ├── @menu                           -> Template's menu files (DO NOT MODIFY)
│   ├── app                             -> App router to handle the template's routings
│   ├── assets                          -> Static assets, like SVG
│   ├── components                      -> Reusable components for the users
│   ├── configs                         -> Configuration files
│   │   ├── i18n.ts                     -> i18n configurations
│   │   ├── primaryColorConfig          -> Primary color configurations
│   │   └── themeConfig.ts              -> Template configurations
│   ├── contexts                        -> Your context files go here
│   ├── data                            -> Data files (navigation structure, search data, etc.)
│   │   ├── dictionaries                -> Translation data for localization
│   │   ├── navigation                  -> Vertical & Horizontal static navigation menu data
│   │   └── searchData.ts               -> Data related to search
│   ├── fake-db                         -> A mock database setup, usually for testing or development purposes
│   ├── hocs                            -> Higher Order Components
│   ├── hooks                           -> Custom hooks
│   │   └── useIntersection             -> Hook to detect when an element enters the viewport - used only for the front pages
│   ├── libs                            -> External libraries Third party libraries
│   │   ├── styles                      -> Styles for third party libraries
│   │   ├── ApexCharts                  -> Renders charts in client side
│   │   ├── Recharts                    -> Renders charts in client side
│   │   ├── ReactPlayer                 -> Renders video player in client side
│   │   └── auth.ts                     -> Authentication using NextAuth.js
│   ├── prisma                          -> Prisma ORM files, including database schema
│   │   ├── migrations                  -> Database schema change history
│   │   ├── dev.db                      -> SQLite database
│   │   └── schema.prisma               -> Model and schema definitions for Prisma
│   ├── redux-store                     -> Redux Store setup
│   │   ├── ReduxProvider.tsx           -> Redux provider
│   │   ├── index.ts                    -> Central Redux store configuration, combines all reducers and configures middleware
│   │   └── slices                      -> Redux slices (individual pieces of state)
│   ├── remove-translation-scripts      -> Script for removing translations from the template
│   ├── types                           -> Type definitions
│   ├── utils                           -> Utility functions
│   └── views                           -> Files that are included in app folder
├── .editorconfig                       -> Configuration file for the editor
├── .env.example                        -> Example environment variables file
├── .eslintrc.js                        -> ESLint configurations (Linting code)
├── .gitignore                          -> Specifies intentionally untracked files to ignore
├── .npmrc                              -> Configuration for npm
├── .prettierrc.json                    -> Prettier configuration for code formatting
├── .stylelintrc.json                   -> Stylelint configuration for style files
├── next.config.mjs                     -> Configuration file for Next.js
├── package.json                        -> Lists dependencies and project metadata
├── pnpm-lock.yaml                      -> Lock file for pnpm, ensuring consistent installations
├── postcss.config.mjs                  -> Configuration for PostCSS
├── tailwind.config.ts                  -> Configuration for Tailwind CSS
└── tsconfig.json                       -> TypeScript configuration file
```

## Core Folders (DO NOT MODIFY)

### @core Folder
**Purpose**: Core template functionality
**Location**: `src/@core`
**Status**: ⚠️ DO NOT MODIFY

Contains:
- `components/` - Core components of the template
- `contexts/` - Settings context for live template customization
- `hooks/` - useSettings hook to access settings context values
- `styles/` - Custom styles for navigation menus, tables, third-party libraries
- `svg/` - SVG components
- `tailwind/` - Tailwind CSS plugin for custom classes
- `utils/` - Utils classes and functions for core features
- `types.ts` - All types of core features (layout, skin, mode, etc.)

### @layouts Folder
**Purpose**: Layout components
**Location**: `src/@layouts`
**Status**: ⚠️ DO NOT MODIFY

Contains:
- `components/` - Layout components (Navbar, Footer, etc.)
- `styles/` - Styled components for horizontal & vertical layouts
- `svg/` - SVG components
- `utils/` - Utils classes for layouts
- `BlankLayout.tsx` - Blank layout component
- `HorizontalLayout.tsx` - Horizontal layout component
- `LayoutWrapper.tsx` - Wrapper component for conditional rendering
- `VerticalLayout.tsx` - Vertical layout component

### @menu Folder
**Purpose**: Menu system
**Location**: `src/@menu`
**Status**: ⚠️ DO NOT MODIFY

Contains:
- `components/` - Components for vertical & horizontal menu
- `contexts/` - Menu context for menu state management
- `hooks/` - Hooks to access menu context values
- `horizontal-menu/` - Horizontal menu imports
- `styles/` - Styled components for menu components
- `svg/` - SVG components
- `utils/` - Utils classes and functions for menu
- `vertical-menu/` - Vertical menu imports
- `defaultConfigs.ts` - Default menu configurations
- `types.ts` - All types of menu features

## Customizable Folders (Safe to Modify)

### app Folder
**Purpose**: App router and pages
**Location**: `src/app`
**Status**: ✅ SAFE TO MODIFY

Structure:
```
app
├── [lang]                      -> Dynamic folder for language-specific content
│   ├── (blank-layout-pages)    -> Pages using blank layout (login, etc.)
│   ├── (dashboard)             -> Main template pages
│   ├── [...not-found]          -> 404 error handling
│   └── layout.tsx              -> Main layout component
├── api                         -> API routes
│   ├── auth                    -> Authentication scripts
│   └── login                   -> Login-related functions
├── globals.css                 -> Global styles
└── favicon.ico                 -> Application favicon
```

### components Folder
**Purpose**: Reusable user components
**Location**: `src/components`
**Status**: ✅ SAFE TO MODIFY

### configs Folder
**Purpose**: Configuration files
**Location**: `src/configs`
**Status**: ✅ SAFE TO MODIFY

Contains:
- `i18n.ts` - Internationalization configurations
- `primaryColorConfig.ts` - Primary color configurations
- `themeConfig.ts` - Template configurations

### data Folder
**Purpose**: Data files
**Location**: `src/data`
**Status**: ✅ SAFE TO MODIFY

Contains:
- `dictionaries/` - Translation data for localization
- `navigation/` - Static navigation menu data
- `searchData.ts` - Search-related data

### views Folder
**Purpose**: Page components
**Location**: `src/views`
**Status**: ✅ SAFE TO MODIFY

## Development Guidelines

### For Customization:
1. **Use `src/components`** for custom components
2. **Use `src/views`** for page components
3. **Use `src/configs`** for configuration changes
4. **Use `src/data`** for data modifications

### For Layout Customization:
- Create `src/layouts` folder
- Copy layouts from `src/@layouts` if needed
- Customize in the new folder

### For Menu Customization:
- Create `src/menu` folder
- Copy files from `src/@menu` if needed
- Customize in the new folder

## File Purposes

### Configuration Files:
- `.env.example` - Environment variables template
- `.eslintrc.js` - ESLint configuration
- `.prettierrc.json` - Code formatting rules
- `.stylelintrc.json` - Style linting rules
- `next.config.mjs` - Next.js configuration
- `tailwind.config.ts` - Tailwind CSS configuration
- `tsconfig.json` - TypeScript configuration

### Package Management:
- `package.json` - Dependencies and scripts
- `pnpm-lock.yaml` - Dependency lock file

## Best Practices

1. **Never modify core folders** (`@core`, `@layouts`, `@menu`)
2. **Use the playground folders** for customization
3. **Copy and customize** rather than modifying core files
4. **Keep customizations organized** in appropriate folders
5. **Follow the established patterns** for consistency

---
**Source**: [Materialize Folder Structure Documentation](https://demos.pixinvent.com/materialize-nextjs-admin-template/documentation/docs/guide/development/folder-structure)
**Last Updated**: December 2024
**Template Version**: Materialize Next.js Admin Template v5.0.0
