# AI Description Generation - Complete UI Workflow

## Overview
This document explains the complete workflow for generating AI-powered product descriptions using source materials (forrásanyagok).

---

## Step-by-Step Workflow

### **Step 1: Navigate to Product Edit Page**
1. Go to `/products` page
2. Click on any product to edit
3. You'll see the product edit form with tabs

---

### **Step 2: Add Source Materials (Forrásanyagok Tab)**

#### **2.1 Open Source Materials Tab**
- Click on the **"Forrásanyagok"** tab (4th tab)
- You'll see a list of existing source materials (if any)
- Click **"Forrásanyag hozzáadása"** button

#### **2.2 Add Source Material Dialog**
A dialog opens with 3 tabs:

**Tab 1: PDF Feltöltés (PDF Upload)**
- Click file input
- Select a PDF file (max 10MB)
- Optionally add:
  - **Cím/Leírás**: Title/description (e.g., "Termék specifikáció")
  - **Prioritás**: 1-10 (higher = more important)
- Click **"Hozzáadás"**
- PDF is uploaded to Supabase Storage
- Status: **"Függőben"** (Pending)

**Tab 2: URL**
- Enter URL (e.g., `https://example.com/product-info`)
- Add title and priority
- Click **"Hozzáadás"**
- Status: **"Függőben"** (Pending)

**Tab 3: Szöveg (Text)**
- Paste or type text content
- Add title and priority
- Click **"Hozzáadás"**
- Status: **"Feldolgozva"** (Processed) - automatically processed!

---

### **Step 3: Process Source Materials**

#### **3.1 Automatic Processing (Text)**
- Text sources are **automatically processed** when added
- System extracts text → chunks it → generates embeddings
- Status changes to **"Feldolgozva"** (Processed)
- Shows word count

#### **3.2 Manual Processing (PDF/URL)**
For PDF and URL sources:
1. Source appears with status **"Függőben"** (Pending)
2. Click **"Feldolgozás indítása"** button
3. System:
   - **PDF**: Downloads → Extracts text → Chunks → Generates embeddings
   - **URL**: Scrapes content → Extracts text → Chunks → Generates embeddings
4. Status changes to **"Feldolgozás alatt"** (Processing) → **"Feldolgozva"** (Processed)
5. Shows word count when processed

#### **3.3 Processing Errors**
- If processing fails, status shows **"Hiba"** (Error)
- Error message is displayed
- You can delete and re-add the source

---

### **Step 4: Generate AI Description**

#### **4.1 Go to Leírás Tab**
- Click on **"Leírás"** tab (3rd tab)
- You'll see the description editor

#### **4.2 Click Generate Button**
- Click **"AI Leírás generálása"** button (top right)
- Confirmation dialog appears:
  - Explains that AI will generate description
  - Warns it will replace current description
  - Click **"Generálás"** to proceed

#### **4.3 Generation Process**
The system:
1. **Finds relevant chunks** from source materials using semantic search
2. **Builds context** from:
   - Product info (SKU, name)
   - Source materials (titles, types)
   - Relevant content chunks (from semantic search)
3. **Generates description** using Claude AI:
   - Uses RAG (Retrieval Augmented Generation)
   - Writes in **Hungarian only** (even if sources are English)
   - 500-1000 words
   - SEO optimized
   - Natural, human-like writing
4. **Fills description field** automatically
5. Shows success toast with metrics (word count, tokens used)

#### **4.4 Generation History**
- Each generation is saved to `product_description_generations` table
- Includes: model used, tokens, source materials used, generated text

---

### **Step 5: Review and Edit**

#### **5.1 Review Generated Description**
- Description appears in the HTML editor
- Review for:
  - Accuracy
  - Completeness
  - Natural Hungarian language
  - SEO optimization

#### **5.2 Edit if Needed**
- Use the HTML editor to:
  - Add/remove content
  - Fix any issues
  - Adjust formatting
  - Toggle between visual and source code mode (Code icon)

#### **5.3 Save Description**
- Click **"Mentés"** (Save) button
- Description is saved to database
- Success toast appears

---

### **Step 6: Sync to Webshop (Optional)**

#### **6.1 Sync to ShopRenter**
- Click **"Szinkronizálás"** button
- Confirmation dialog appears
- Click **"Szinkronizálás"** to push to webshop
- System:
  - Pushes description to ShopRenter
  - Pulls back to verify
  - Updates sync status

---

## Visual Workflow Diagram

```
┌─────────────────────────────────────────────────────────┐
│ 1. Product Edit Page                                    │
│    └─> Click "Forrásanyagok" tab                        │
└─────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────┐
│ 2. Add Source Materials                                 │
│    ├─> PDF: Upload → Pending                            │
│    ├─> URL: Enter → Pending                             │
│    └─> Text: Paste → Auto-processed                      │
└─────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────┐
│ 3. Process Sources (if needed)                          │
│    ├─> PDF: Click "Feldolgozás" → Processing → Done    │
│    ├─> URL: Click "Feldolgozás" → Processing → Done    │
│    └─> Text: Already processed                          │
└─────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────┐
│ 4. Generate Description                                 │
│    └─> "Leírás" tab → "AI Leírás generálása"           │
│        → RAG search → Claude AI → Hungarian description│
└─────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────┐
│ 5. Review & Edit                                        │
│    └─> Edit in HTML editor → Save                        │
└─────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────┐
│ 6. Sync to Webshop (Optional)                           │
│    └─> "Szinkronizálás" → Push to ShopRenter            │
└─────────────────────────────────────────────────────────┘
```

---

## Status Indicators

### Source Material Statuses:
- **Függőben** (Pending) - Not processed yet
- **Feldolgozás alatt** (Processing) - Currently being processed
- **Feldolgozva** (Processed) - Ready to use (shows word count)
- **Hiba** (Error) - Processing failed (shows error message)

### Icons:
- 📄 **DescriptionIcon** - PDF source
- 🔗 **LinkIcon** - URL source
- 📝 **TextIcon** - Text source
- ✅ **CheckCircle** - Processed successfully
- ⏳ **HourglassEmpty** - Pending
- ❌ **ErrorIcon** - Error
- 🔄 **CircularProgress** - Processing

---

## Key Features

### **1. Smart Processing**
- Text sources: Auto-processed immediately
- PDF/URL: Manual processing (click button)
- Shows real-time status updates

### **2. Semantic Search (RAG)**
- Finds most relevant content chunks
- Uses embeddings for similarity search
- Only uses chunks relevant to the product

### **3. Hungarian-Only Output**
- **Mandatory**: All descriptions in Hungarian
- Translates English/German sources to Hungarian
- Uses proper Hungarian terminology
- Natural Hungarian writing (not literal translation)

### **4. Quality Control**
- Review before saving
- Edit in rich text editor
- Toggle source code view
- Save when satisfied

---

## Example Workflow

### Scenario: Adding a new product

1. **Add Sources**:
   - Upload PDF: "Product Specification.pdf"
   - Add URL: "https://manufacturer.com/product-info"
   - Paste text: "This is a high-quality cabinet hinge..."

2. **Process**:
   - Text: Auto-processed ✅
   - PDF: Click "Feldolgozás" → Processing... → Done ✅
   - URL: Click "Feldolgozás" → Processing... → Done ✅

3. **Generate**:
   - Go to "Leírás" tab
   - Click "AI Leírás generálása"
   - Wait 10-30 seconds
   - Description appears in Hungarian ✅

4. **Review**:
   - Check description quality
   - Edit if needed
   - Save

5. **Sync**:
   - Click "Szinkronizálás"
   - Description pushed to webshop ✅

---

## Troubleshooting

### **Source won't process?**
- Check file size (PDF max 10MB)
- Check URL is accessible
- Check server logs for errors
- Try deleting and re-adding

### **Description not generating?**
- Ensure at least one source is "Feldolgozva" (Processed)
- Check Anthropic API key is working
- Check server logs
- Try again (may be temporary API issue)

### **Description in wrong language?**
- System should always generate Hungarian
- If you see English, report as bug
- Check source materials aren't causing confusion

---

## Tips for Best Results

1. **Add multiple sources** - More sources = better context
2. **Set priorities** - Important sources should have higher priority (8-10)
3. **Use descriptive titles** - Helps AI understand source purpose
4. **Process all sources** - Only processed sources are used
5. **Review before saving** - Always check generated content
6. **Edit if needed** - AI is good but not perfect

---

## Technical Details

- **Storage**: PDFs stored in Supabase Storage (`product-sources` bucket)
- **Processing**: Extracts text → Chunks (500 words, 100 overlap) → Generates embeddings
- **RAG**: Semantic search finds top 10 relevant chunks
- **AI Model**: Claude 3.5 Sonnet (falls back to Haiku if not available)
- **Language**: Enforced Hungarian in prompts
- **Output**: HTML format with headings, paragraphs, lists

---

This workflow ensures you get high-quality, SEO-optimized, Hungarian product descriptions from any source material language!
