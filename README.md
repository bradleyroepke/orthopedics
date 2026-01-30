# Ortho Docs

A password-protected web application to organize and search your orthopedic documents (PDFs, presentations, textbooks) with inline PDF viewing, organized by subspecialty.

## Features

- Password-protected login
- Browse documents by subspecialty (sidebar navigation)
- Search by title, author, journal, year
- Inline PDF viewing with zoom and page navigation
- Download PDFs
- Responsive design

## Quick Start

### Prerequisites

- Node.js 18+ installed
- Your Orthopedics folder with PDFs

### Installation

1. **Install dependencies:**
   ```bash
   cd ortho-docs
   npm install
   ```

2. **Configure environment:**

   Edit `.env` and update:
   - `DOCUMENTS_PATH` - Path to your Orthopedics folder
   - `ADMIN_PASSWORD` - Choose a secure password
   - `AUTH_SECRET` - Generate a random 32+ character string

3. **Initialize the database:**
   ```bash
   npm run db:generate
   npm run db:push
   ```

4. **Create admin user:**
   ```bash
   npm run db:seed
   ```

5. **Index your documents:**
   ```bash
   npm run index
   ```

6. **Start the development server:**
   ```bash
   npm run dev
   ```

7. **Open http://localhost:3000** and log in with your admin credentials.

## Folder Structure Expected

The indexing script expects your documents organized like:

```
Orthopedics/
├── Foot and Ankle/
│   └── Author_Year_Journal_Title.pdf
├── Hand/
├── Hip and Knee/
├── Shoulder and Elbow/
├── Spine/
├── Sports Medicine/
├── Trauma/
├── Oncology/
├── Pediatrics/
├── Textbooks/
├── Presentations/
└── Research/
```

## File Naming Convention

For best metadata extraction, name files as:
```
Author_Year_Journal_Title.pdf
```

Examples:
- `Smith_2023_JBJS_Ankle-Fracture-Management.pdf`
- `Johnson_2022_AJSM_ACL-Reconstruction-Outcomes.pdf`

Use "Unknown" for missing fields:
- `Unknown_2023_JBJS_Some-Title.pdf`

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm run start` | Start production server |
| `npm run db:generate` | Generate Prisma client |
| `npm run db:push` | Push schema to database |
| `npm run db:seed` | Create admin user |
| `npm run index` | Index documents from folder |

## Default Login

- **Email:** admin@ortho-docs.local
- **Password:** changeme123

Change these in `.env` before running `npm run db:seed`.

## Tech Stack

- **Framework:** Next.js 14 (App Router)
- **Language:** TypeScript
- **Styling:** Tailwind CSS + shadcn/ui components
- **Database:** SQLite with Prisma ORM
- **Auth:** NextAuth.js v5
- **PDF Viewer:** react-pdf (PDF.js)
- **Search:** Fuse.js (client-side fuzzy search)

## Project Structure

```
ortho-docs/
├── prisma/
│   └── schema.prisma          # Database schema
├── scripts/
│   ├── index-documents.ts     # Scan folders, extract metadata
│   └── seed.ts                # Create admin user
├── src/
│   ├── app/
│   │   ├── (dashboard)/       # Protected routes
│   │   │   ├── page.tsx       # Dashboard
│   │   │   ├── documents/[id] # Document viewer
│   │   │   └── subspecialty/  # Browse by subspecialty
│   │   ├── login/             # Login page
│   │   └── api/               # API routes
│   ├── components/
│   │   ├── layout/            # Sidebar, Header
│   │   ├── documents/         # DocumentList, PDFViewer
│   │   ├── auth/              # LoginForm
│   │   └── ui/                # shadcn/ui components
│   └── lib/
│       ├── prisma.ts          # Database client
│       ├── auth.ts            # NextAuth config
│       └── search.ts          # Fuse.js search
└── .env                       # Configuration
```

## Future Enhancements (Phase 2-3)

- Full-text PDF search with MeiliSearch
- User invitation system with role-based access
- Favorites and reading lists
- Cloud deployment (Vercel + PostgreSQL + Cloudflare R2)
- DOI and abstract extraction from PDFs

## Troubleshooting

### PDFs not loading
- Check that `DOCUMENTS_PATH` in `.env` points to the correct folder
- Ensure the PDF files exist at the paths stored in the database
- Check browser console for errors

### Search not finding documents
- Re-run `npm run index` to refresh the database
- Search is fuzzy - try partial matches

### Login not working
- Ensure you ran `npm run db:seed` after `npm run db:push`
- Check the email and password match what's in `.env`
