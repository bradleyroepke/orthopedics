# Orthopedic Index

Orthopedic documentation management application.

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS with shadcn/ui components
- **Database**: Prisma ORM
- **Auth**: NextAuth v5
- **Search**: Fuse.js
- **PDF**: react-pdf

## Project Structure

```
src/
├── app/
│   ├── (dashboard)/     # Main authenticated routes
│   ├── api/             # API routes
│   └── login/           # Auth pages
├── components/
│   ├── auth/            # Authentication components
│   ├── documents/       # Document-related components
│   ├── layout/          # Header, Sidebar
│   └── ui/              # shadcn/ui components
└── lib/                 # Utilities and shared code
```

## Common Commands

```bash
npm run dev          # Start development server
npm run build        # Production build
npm run db:generate  # Generate Prisma client
npm run db:push      # Push schema to database
npm run db:seed      # Seed database
npm run index        # Index documents
```

## Domain Context

This app manages orthopedic medical documentation organized by subspecialties. Key concepts:
- **Documents**: Medical PDFs and documentation
- **Subspecialties**: Orthopedic specialization areas (e.g., spine, sports medicine, trauma)

## ICD-10 Codes

When working with orthopedic diagnoses, relevant ICD-10-CM chapters include:
- **M00-M99**: Diseases of the musculoskeletal system and connective tissue
- **S00-T88**: Injury, poisoning, and certain other consequences of external causes

## Conventions

- Use TypeScript strict mode
- Follow Next.js App Router patterns
- Use server components by default, client components only when needed
- Prisma for all database operations
