# Medic1905 — Telemedicine Platform

A modern telemedicine and medical records platform built with Next.js, featuring a Beeline-inspired design system with neon accents and rounded cards.

## Tech Stack

- **Frontend**: Next.js 16 (App Router) + Tailwind CSS v4 + shadcn/ui components
- **Database**: Neon (PostgreSQL) with Prisma ORM
- **AI**: Kimi K3 for medical history analysis and diagnostics assistance
- **Hosting**: Vercel

## Design System

Beeline-inspired design language:
- Primary: Neon Yellow (#FFD400)
- Secondary: Teal (#22D3EE)
- Background: Dark Navy (#0A0F1C)
- Rounded cards (20-28px radius)
- Soft shadows and neon glow effects
- Mobile-first layout

## Modules

### Doctor Module
- Doctor Directory with search, filters, and booking
- Doctor Profile with schedule, reviews, and expertise
- Doctor Dashboard with appointments and pending results

### Patient Module
- Patient Dashboard with quick actions and AI assistant
- Patient Profile with medical ID and emergency contacts
- Medical History Timeline with neon dots
- AI-powered Medical History form with Kimi K3

### Lab Test Module
- Lab Test Catalog with category tiles
- Lab Test Order Form
- Lab Results List with status badges
- Lab Result Detail with AI interpretation

### Diagnostics Module
- Diagnostics Overview with color-coded indicators
- Diagnostics Detail with lab/imaging/notes summary
- Doctor Diagnostics Workspace (side-by-side layout)

## AI Pipeline (Kimi K3)

The AI pipeline provides:
1. Guided questioning
2. Symptom clustering
3. Timeline generation
4. Risk factor highlighting
5. Structured clinician summary
6. Patient-friendly recap
7. Suggested follow-up questions

### Safety Constraints
- No diagnosis
- No prescriptions
- No emergency instructions
- All outputs clearly labeled as assistive only

## Getting Started

```bash
# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your Neon DATABASE_URL and KIMI_API_KEY

# Generate Prisma client
npx prisma generate

# Push schema to database
npx prisma db push

# Run development server
npm run dev
```

## License

MIT
