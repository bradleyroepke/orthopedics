# Orthopedic Index - Development Roadmap

## Current State (January 2026)
- 3,192 documents indexed
- 931 landmark articles imported (210 matched to library = 23%)
- Subspecialties: Foot & Ankle, Hand, Hip & Knee, Shoulder & Elbow, Spine, Sports Medicine, Trauma, Oncology, Pediatrics
- Features: Document browsing, search, PDF viewer, OITE section, Landmark Articles timeline

---

## Priority 1: Consistent Article Formatting

### Problem
Document filenames are inconsistent, making matching and organization difficult:
- Some: `Author_Year_Journal_Title.pdf`
- Some: `Journal Year Title.pdf`
- Some: `descriptive-name.pdf`
- Many have no parsed metadata (author, year, journal = null)

### Solution: Document Renaming Tool

#### Phase 1: Metadata Extraction Script
Create a script that:
1. Reads each PDF's first page text (using pdf-parse library)
2. Uses AI/regex to extract: Author, Year, Journal, Title
3. Stores extracted metadata in database
4. Generates suggested new filename

```
Suggested format: Author_Year_Journal_ShortTitle.pdf
Example: Neer_1972_JBJS_Displaced-Proximal-Humeral-Fractures.pdf
```

#### Phase 2: Bulk Rename Interface
- Admin page showing documents with suggested renames
- Preview before/after
- Batch approve or edit individually
- Update database and filesystem together

#### Phase 3: Import Validation
- When indexing new documents, validate filename format
- Suggest corrections for non-conforming files

---

## Priority 2: Enhanced Subspecialty Organization

### Current Issues
- Documents often miscategorized based on folder location
- Some documents span multiple subspecialties
- No secondary categorization (e.g., "Trauma" + "Hip")

### Improvements

#### Multi-Subspecialty Tagging
- Allow documents to have multiple subspecialty tags
- Primary subspecialty (required) + Secondary tags (optional)
- Update schema:
```prisma
model Document {
  // existing fields...
  subspecialty String // primary
  tags String[] // secondary subspecialties
}
```

#### Smart Categorization
- Analyze document titles/content for keywords
- Suggest additional tags based on content
- Example: "Proximal Humerus Fracture" → Trauma + Shoulder

#### Subspecialty Landing Pages
- Each subspecialty gets a dedicated page with:
  - Overview/description
  - Landmark articles for that specialty (highlighted)
  - Recent additions
  - Most viewed documents
  - Related subspecialties

---

## Priority 3: Landmark Article Highlighting

### Current State
- 210 of 931 landmark articles matched (23%)
- Articles shown in separate /landmarks page
- No indication on regular document pages

### Improvements

#### Visual Indicators Everywhere
- Add "Landmark" badge to DocumentCard when document is linked to landmark article
- Show star icon in search results
- Highlight in subspecialty listings

#### Landmark Context
- When viewing a landmark article, show:
  - Why it's important (from timeline description)
  - Year published and historical context
  - Related landmark articles (same subspecialty, similar era)

#### Reading Progress
- Track which landmark articles user has read
- Show progress per subspecialty
- "Essential Reading" checklist feature

#### Manual Linking Interface
- For unmatched landmark articles, allow admin to:
  - Search existing documents
  - Link manually with one click
  - Mark as "Not in library - acquire"

---

## Priority 4: Study Features for Residents

### Rotation-Based Collections
- Pre-built collections for each rotation:
  - PGY-1 Trauma rotation essentials
  - Sports Medicine rotation reading list
  - etc.
- Based on ACGME milestones

### OITE Preparation
- Link OITE questions to relevant landmark articles
- Track which topics have been studied
- Spaced repetition reminders

### Personal Collections
- Users can create custom collections
- Share collections with co-residents
- "Favorites" and "Read Later" lists

### Notes & Annotations
- Take notes on documents
- Highlight important passages (if PDF.js supports)
- Export notes for review

---

## Priority 5: Search Improvements

### Current State
- Basic Fuse.js search on title, author, filename

### Improvements

#### Advanced Filters
- Filter by year range
- Filter by journal
- Filter by document type
- Filter by "has landmark article"

#### Search Within Subspecialty
- When on subspecialty page, search scoped to that specialty
- Global search with subspecialty facets

#### Full-Text Search (Future)
- Extract text from PDFs
- Index in search engine (Elasticsearch or similar)
- Search within document content

---

## Priority 6: Content Acquisition

### Missing Landmark Articles Report
Create a report showing:
- Landmark articles not in library
- Grouped by subspecialty
- Sorted by importance (star rating in timeline)
- Links to PubMed/journal for acquisition

### Wishlist Feature
- Mark articles as "wanted"
- Track acquisition status
- Notify when added to library

---

## Technical Debt & Improvements

### Performance
- Implement pagination on large document lists
- Add loading states consistently
- Cache API responses where appropriate

### Code Quality
- Add unit tests for critical functions
- Add E2E tests for main user flows
- Document API endpoints

### Mobile Responsiveness
- Test and fix mobile layouts
- Touch-friendly PDF viewer
- Offline capability (PWA)

---

## Implementation Order (Suggested)

### Session 1 (Next)
1. Add "Landmark" badge to DocumentCard
2. Create manual linking interface for landmark articles
3. Improve document detail page to show landmark context

### Session 2
1. Create metadata extraction script (PDF parsing)
2. Build rename suggestion interface
3. Test on small batch of documents

### Session 3
1. Add multi-subspecialty tagging
2. Create subspecialty landing pages
3. Add "Essential Reading" progress tracking

### Session 4
1. Implement favorites/collections
2. Add notes feature
3. Create missing articles report

---

## Database Schema Changes Needed

```prisma
// Add to Document model
model Document {
  // existing...
  tags          String[]
  isLandmark    Boolean   @default(false)
  extractedMeta Json?     // AI-extracted metadata
}

// Add user features
model UserDocument {
  id         String   @id @default(cuid())
  userId     String
  documentId String
  user       User     @relation(fields: [userId], references: [id])
  document   Document @relation(fields: [documentId], references: [id])

  isFavorite Boolean  @default(false)
  isRead     Boolean  @default(false)
  readAt     DateTime?
  notes      String?

  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  @@unique([userId, documentId])
}

model Collection {
  id          String   @id @default(cuid())
  name        String
  description String?
  userId      String
  user        User     @relation(fields: [userId], references: [id])
  documents   CollectionDocument[]
  isPublic    Boolean  @default(false)

  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}

model CollectionDocument {
  id           String     @id @default(cuid())
  collectionId String
  documentId   String
  collection   Collection @relation(fields: [collectionId], references: [id])
  document     Document   @relation(fields: [documentId], references: [id])
  order        Int        @default(0)

  @@unique([collectionId, documentId])
}
```

---

## Quick Wins (Can Do Immediately)

1. **Add landmark badge to DocumentCard** - 15 min
2. **Show landmark count on subspecialty pages** - 10 min
3. **Add "View Landmarks" button on subspecialty pages** - 10 min
4. **Create missing articles report page** - 30 min
5. **Add search to landmarks page** - 20 min

---

*Last updated: January 30, 2026*
