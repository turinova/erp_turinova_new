# Status Transitions Analysis - Purchase Orders

## 📊 Industry Best Practices Analysis

### Key Findings from Major ERPs:

1. **SAP Ariba / SAP S/4HANA**
   - Status: Draft → Submitted → Approved → Ordered → Partially Received → Received → Completed
   - **Key Feature**: One-click status transitions with confirmation dialogs
   - **UX**: Visual status indicators (color-coded chips) + progress bar
   - **Validation**: Cannot edit items after "Approved", cannot delete after "Ordered"

2. **Oracle NetSuite**
   - Status: Pending Approval → Approved → Pending Billing → Billed → Closed
   - **Key Feature**: Bulk status transitions for multiple POs
   - **UX**: Status dropdown with only valid next states shown
   - **Validation**: Approval workflow with user permissions

3. **Odoo**
   - Status: Draft → Sent → Purchase Order → Locked → Done → Cancel
   - **Key Feature**: Automatic status updates based on receiving
   - **UX**: Action buttons (not dropdowns) - "Confirm", "Receive", "Done"
   - **Validation**: Cannot modify after "Locked"

4. **QuickBooks**
   - Status: Open → Pending → Closed
   - **Key Feature**: Simple, intuitive workflow
   - **UX**: Large action buttons with clear labels
   - **Validation**: Minimal - focuses on simplicity

5. **Shopify Plus**
   - Status: Draft → Open → Sent → Partially Fulfilled → Fulfilled → Cancelled
   - **Key Feature**: Real-time status updates
   - **UX**: Timeline view showing status history
   - **Validation**: Cannot edit after "Sent"

---

## 🎯 Recommended Approach for Our ERP

Based on analysis, here's the **most user-friendly** approach:

### **Status Workflow:**

```
draft → pending_approval → approved → partially_received → received → cancelled
         ↑                                                                    ↑
         └────────────────────────────────────────────────────────────────────┘
                    (Can cancel from any status except 'received')
```

### **Key UX Principles:**

1. **Action Buttons (Not Dropdowns)**
   - ✅ "Jóváhagyás" button (Draft → Pending Approval)
   - ✅ "Jóváhagyva" button (Pending Approval → Approved)
   - ✅ "Törlés" button (Any status → Cancelled, except Received)
   - ❌ No confusing dropdown menus

2. **Visual Status Indicators**
   - Color-coded chips: Draft (gray), Pending (yellow), Approved (green), Received (blue), Cancelled (red)
   - Progress bar showing workflow position
   - Status history timeline

3. **Smart Validation**
   - **Draft/Pending Approval**: Full editing allowed
   - **Approved**: Can only view, cannot edit items (but can create shipment)
   - **Received**: Read-only, cannot edit or cancel
   - **Cancelled**: Read-only, cannot reactivate

4. **One-Click Transitions**
   - Confirmation dialog for destructive actions (cancellation)
   - Immediate feedback (toast notifications)
   - Auto-refresh after status change

5. **Bulk Operations**
   - Select multiple POs → Bulk approve
   - Select multiple POs → Bulk cancel (if allowed)

6. **Status-Based UI**
   - Show/hide buttons based on current status
   - Disable form fields when not editable
   - Show helpful messages ("This PO is approved and cannot be edited")

---

## 🔄 Status Transition Rules

### **Purchase Orders:**

| From Status | To Status | User Action | Validation |
|------------|-----------|-------------|------------|
| `draft` | `pending_approval` | Click "Jóváhagyás" | Must have at least 1 item |
| `draft` | `cancelled` | Click "Törlés" | Confirmation dialog |
| `pending_approval` | `approved` | Click "Jóváhagyva" | Must be authorized user |
| `pending_approval` | `draft` | Click "Visszavonás" | Only if not yet approved |
| `pending_approval` | `cancelled` | Click "Törlés" | Confirmation dialog |
| `approved` | `cancelled` | Click "Törlés" | Confirmation dialog (warning: may have shipments) |
| `approved` | `partially_received` | Auto (when shipment created) | Automatic |
| `partially_received` | `received` | Auto (when all items received) | Automatic |
| `received` | ❌ | None | Cannot change |

### **Shipments:**

| From Status | To Status | User Action | Validation |
|------------|-----------|-------------|------------|
| `waiting` | `in_transit` | Click "Indítás" | Must have items |
| `in_transit` | `arrived` | Click "Megérkezett" | - |
| `arrived` | `inspecting` | Click "Ellenőrzés kezdése" | - |
| `inspecting` | `completed` | Click "Bevételezés befejezése" | All items inspected |
| Any | `cancelled` | Click "Törlés" | Confirmation dialog |

---

## 💡 Implementation Strategy

### **API Endpoints:**

1. **`PUT /api/purchase-orders/[id]/status`**
   - Purpose: Change PO status
   - Request: `{ "status": "pending_approval", "note": "Optional" }`
   - Validation: Check transition rules
   - Response: Updated PO with new status

2. **`PUT /api/purchase-orders/[id]/approve`**
   - Purpose: Approve PO (sets `approved_at`, `approved_by`)
   - Request: `{ "note": "Optional" }`
   - Validation: Check user permissions, PO must be `pending_approval`
   - Response: Updated PO with status `approved`

3. **`PUT /api/purchase-orders/[id]/cancel`**
   - Purpose: Cancel PO
   - Request: `{ "reason": "Optional" }`
   - Validation: Cannot cancel if `received`, check for linked shipments
   - Response: Updated PO with status `cancelled`

### **Frontend Components:**

1. **StatusChip Component**
   - Color-coded based on status
   - Tooltip with status description
   - Click to view status history

2. **StatusActionButtons Component**
   - Shows only valid actions for current status
   - Large, clear buttons
   - Confirmation dialogs for destructive actions

3. **StatusHistoryTimeline Component**
   - Shows all status changes
   - User who made change
   - Timestamp
   - Notes/reasons

---

## ✅ Benefits of This Approach

1. **User-Friendly**: Clear action buttons, no confusing dropdowns
2. **Intuitive**: Follows industry standards (SAP, Odoo patterns)
3. **Safe**: Validation prevents invalid transitions
4. **Transparent**: Status history shows what happened
5. **Flexible**: Can extend with more statuses later
6. **Fast**: One-click transitions, no multi-step processes

---

## 🚀 Next Steps

1. Implement status transition API endpoints
2. Create status validation functions
3. Build frontend status components
4. Add status history tracking
5. Implement bulk status operations
