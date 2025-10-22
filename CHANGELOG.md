# Changelog

All notable changes to the Turinova ERP system will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Added - October 22, 2025

#### 📱 SMS Notification System
- **SMS notifications** when orders are ready for pickup (status: `in_production` → `ready`)
- **SMS Confirmation Modal** on scanner page (`/scanner`)
  - Shows list of SMS-eligible customers with phone numbers
  - All checkboxes checked by default
  - Admin can selectively disable SMS for specific customers
  - "Select all" / "Unselect all" functionality
- **Twilio integration** for SMS delivery
  - Phone number normalization (removes spaces)
  - E.164 format validation
  - Hungarian character handling (ASCII conversion)
  - Detailed error logging
- **New API endpoints**:
  - `POST /api/orders/sms-eligible` - Check SMS eligibility for orders
  - Updated `PATCH /api/orders/bulk-status` - Accept `sms_order_ids` parameter
- **Toast notifications** showing SMS sending results:
  - Success: "📱 X SMS értesítés elküldve"
  - Failure: "⚠️ X SMS küldése sikertelen: [error]"
- **Database field**: `customers.sms_notification` (boolean flag for opt-in)
- **Environment variables**: 
  - `TWILIO_ACCOUNT_SID`
  - `TWILIO_AUTH_TOKEN`
  - `TWILIO_PHONE_NUMBER`
- **SMS message template**: Customizable Hungarian message with order details

**Files Added**:
- `main-app/src/lib/twilio.ts` - Twilio SMS utility
- `main-app/src/app/api/orders/sms-eligible/route.ts` - SMS eligibility checker
- `main-app/src/app/(dashboard)/scanner/SmsConfirmationModal.tsx` - Confirmation modal

**Files Modified**:
- `main-app/src/app/(dashboard)/scanner/ScannerClient.tsx` - SMS modal integration
- `main-app/src/app/api/orders/bulk-status/route.ts` - SMS sending logic

**Documentation**:
- `docs/SMS_NOTIFICATION_SYSTEM.md` - Complete SMS system documentation

---

#### 🚀 Server Startup Documentation
- **Server Startup Guide** (`SERVER_STARTUP_GUIDE.md`)
  - Complete process for starting both main app and customer portal
  - Troubleshooting guide for common issues
  - Verification tests with curl commands
  - Common mistakes to avoid
  - Quick reference commands

---

#### 🔐 Security Improvements
- **Environment variable security**
  - Added `.env.local` to `.gitignore`
  - Created `env.template` for secure setup
  - Documented security incident in `SECURITY_INCIDENT_ENV_EXPOSURE.md`
  - Removed exposed credentials from Git history

---

#### 🎨 Customer Portal - Login Page UI
- **LiquidEther background** on login page left side
  - Greyscale wave animation
  - White background
  - Interactive mouse effects
- **Animated title** with CountUp component
  - "Magyarország 1 számú ERP rendszere asztalos vállalkozások számára"
  - Number animates from 100 → 1

**Files Added**:
- `customer-portal/components/LiquidEther.tsx` - Animated background component
- `customer-portal/components/LiquidEther.css` - Styles for LiquidEther
- `customer-portal/components/CountUp.tsx` - Number animation component

**Files Modified**:
- `customer-portal/views/Login.tsx` - Integrated LiquidEther and CountUp

---

#### 🛒 Customer Portal - Quote Submission System
- **Quote submission** from customer portal to main app database
  - Find or create customer in company DB by email
  - Generate company quote number (Q-2025-XXX)
  - Copy all quote data (panels, pricing, edges, services)
  - Set quote source to `customer_portal`
  - Update portal quote status to `submitted`
- **Orders page** (`/orders`) for customer portal
  - Lists only submitted quotes
  - Shows portal quote number and company quote number
  - Displays company quote status (fetched from company DB)
  - Real-time data synchronization
  - Search by company quote number
  - Pagination support
- **Navigation updates**
  - Added "Megrendelések" menu item
  - Added `/orders` to allowed paths

**Files Added**:
- `customer-portal/app/api/portal-quotes/submit/route.ts` - Quote submission API
- `customer-portal/app/(dashboard)/orders/page.tsx` - Orders list page (SSR)
- `customer-portal/app/(dashboard)/orders/OrdersClient.tsx` - Orders list UI
- `customer-portal/supabase/migrations/create_customer_portal_system_user.sql` - System user migration

**Files Modified**:
- `customer-portal/lib/supabase-server.ts` - Added `getPortalQuoteById`, `getPortalOrdersWithPagination`
- `customer-portal/lib/company-data-server.ts` - Added `getCompanyInfo`
- `customer-portal/app/(dashboard)/saved/[quote_id]/page.tsx` - Quote detail page (SSR)
- `customer-portal/app/(dashboard)/saved/[quote_id]/PortalQuoteDetailClient.tsx` - Quote detail UI
- `customer-portal/app/(dashboard)/saved/SavedQuotesClient.tsx` - Added row click navigation
- `customer-portal/data/navigation/verticalMenuData.tsx` - Added Orders menu
- `customer-portal/permissions/PermissionProvider.tsx` - Added `/orders` permission
- `customer-portal/hooks/useNavigation.ts` - Added `/orders` to allowed paths

---

#### 📊 Main App - Quote Source Tracking
- **Source column** in quotes list (`/quotes`)
  - Displays "Admin" for internal quotes
  - Displays "Ügyfél" for customer portal quotes
  - Uses colored chips for visual distinction
- **Source information** in quote detail page
  - Added to "Árajánlat információk" card
  - Shows source with chip styling

**Files Modified**:
- `main-app/src/lib/supabase-server.ts` - Added `source` field to queries
- `main-app/src/app/(dashboard)/quotes/QuotesClient.tsx` - Added Source column
- `main-app/src/app/(dashboard)/quotes/[quote_id]/QuoteDetailClient.tsx` - Added Source info

---

#### 🌐 Deployment Configuration
- **Vercel configuration** for both apps
  - Main app: `main-app/vercel.json`
  - Customer portal: `customer-portal/vercel.json`
- **Deployment documentation**
  - Complete guide: `DEPLOYMENT_GUIDE.md`
  - Separate deployment processes for main app and customer portal
  - DNS configuration instructions
  - Environment variable setup

**URLs**:
- Main app: `app.turinova.hu`
- Customer portal: `turinova.hu`

---

#### 🐛 Bug Fixes
- **Customer portal logout issue** (race condition)
  - Enhanced session clearing in `AuthContext.tsx`
  - Improved middleware session validation
  - Force hard reload after logout
  - Fixed infinite redirect loop
- **DELETE RLS policy** for `portal_quotes`
  - Added missing policy for portal customers
- **Quote detail page** - Fixed edge material names in cutting list
- **Server startup issues** - Fixed EPERM and network interface errors

---

### Changed

#### 🔄 Customer Portal - Logout Flow
- Enhanced `signOut()` function with immediate state clearing
- Added 100ms delay for cookie clearing
- Force hard reload to clear all cached state
- Updated middleware to validate sessions with `getUser()`

---

### Fixed

#### 🔧 Phone Number Handling
- Phone numbers with spaces now properly normalized before SMS sending
- E.164 format validation added
- Hungarian characters in SMS messages replaced with ASCII equivalents

#### 🔧 Checkbox Event Handling
- Fixed double-toggle issue in SMS confirmation modal
- Added `stopPropagation()` to prevent row click when clicking checkbox

---

## [1.0.0] - 2025-10-13

### Added
- Initial permission system implementation
- Multi-tenancy support
- Customer portal infrastructure
- Quote optimization system (Opti page)
- Database migrations for core tables
- Authentication system (Supabase Auth)

---

## Version History

- **v1.1.0** (unreleased) - SMS notifications, quote submission, source tracking
- **v1.0.0** (2025-10-13) - Initial release with permission system

---

*For detailed commit history, see Git log or contact the development team.*

