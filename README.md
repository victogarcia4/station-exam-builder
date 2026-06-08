# Station Exam Builder

> Station-based practical exam platform for Anatomy & Physiology lab courses (BIOL 2401/2402)

[![Next.js](https://img.shields.io/badge/Next.js-16-black)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19-blue)](https://react.dev/)
[![License](https://img.shields.io/badge/License-MIT-green)](LICENSE)

## 🎯 Overview

Station Exam Builder is a modern web application designed for anatomy & physiology lab practical exams. Students navigate through stations with images, answer multiple-choice questions, and receive instant feedback in study mode or timed assessments in exam mode.

### Key Features

- **📚 Dual Modes:** Study Guide (free navigation + instant feedback) | Exam (timed + sequential)
- **🖼️ 28 Stations:** High-quality AI-generated anatomical diagrams with numbered labels
- **❓ 105 Questions:** Complete question bank with rationales and learning objectives
- **🎓 Bloom's Taxonomy:** Questions mapped to cognitive levels (Remember → Create)
- **📄 PDF Export:** Downloadable performance reports with missed questions
- **♿ ADA Compliant:** High contrast, keyboard navigation, screen reader support
- **🎨 Premium Design:** Custom design system with Fraunces + Outfit fonts

## 🚀 Live Demo

🔗 **Production:** [Coming soon - Vercel deployment in progress]

## 🏗️ Tech Stack

- **Framework:** Next.js 16 (App Router) + Turbopack
- **Frontend:** React 19
- **Styling:** Vanilla CSS with design tokens
- **PDF Generation:** jsPDF
- **Fonts:** Fraunces (serif) + Outfit (sans-serif)
- **Deployment:** Vercel

## 📦 Installation

```bash
# Clone the repository
git clone https://github.com/YOUR-USERNAME/station-exam-builder.git
cd station-exam-builder

# Install dependencies
npm install

# Run development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## 🎓 Usage

### Student Flow

1. **Registration:** Enter name, Lone Star College email, course, section, date
2. **Mode Selection:**
   - **Study Guide:** Navigate freely, get instant feedback and rationales
   - **Exam Mode:** 105-minute timer, sequential navigation, no feedback until results
3. **Complete Stations:** Answer 3-4 questions per station (28 stations total)
4. **View Results:** Score breakdown, missed questions, Bloom's performance
5. **Export PDF:** Download personalized report

### Email Validation

Only Lone Star College emails are accepted:
- `@lonestar.edu`
- `@my.lonestar.edu`

## 📁 Project Structure

```
station-exam-builder/
├── app/
│   ├── layout.js          # Root layout with fonts & metadata
│   ├── page.js            # Landing page (student registration)
│   ├── exam/
│   │   └── page.js        # Station view + results screen
│   └── globals.css        # Design system (900+ lines)
├── lib/
│   ├── examData.js        # Question bank & scoring logic
│   └── pdfExport.js       # PDF report generation
├── data/
│   └── seed-biol2401.json # BIOL 2401 question bank (105 questions)
├── public/
│   └── stations/          # 28 station images (56MB total)
└── package.json
```

## 🎨 Design System

### Colors

- **Primary:** Deep navy (`#1e293b`) + Teal accent (`#0f766e`)
- **Bloom's Taxonomy:**
  - Remember: `#3b82f6` (blue)
  - Understand: `#10b981` (green)
  - Apply: `#f59e0b` (amber)
  - Analyze: `#8b5cf6` (purple)
  - Evaluate: `#ec4899` (pink)
  - Create: `#ef4444` (red)

### Typography

- **Serif (Headings):** Fraunces (Variable 500-900)
- **Sans-serif (Body):** Outfit (Variable 400-700)

## 🔮 Roadmap

### Phase 2 - Data Persistence (In Progress)
- [ ] Supabase integration (PostgreSQL)
- [ ] Student attempt logging
- [ ] Admin dashboard for viewing results

### Phase 3 - Instructor Tools
- [ ] Question bank management
- [ ] File upload (PDF/XLSX parsing)
- [ ] Analytics & reports

### Phase 4 - AI Image Generation
- [ ] OpenRouter integration
- [ ] Batch station image generation
- [ ] ADA compliance validation

### Phase 5 - BIOL 2402 Support
- [ ] Add 26-station BIOL 2402 exam
- [ ] Cross-course analytics
- [ ] Performance optimization

## 🤝 Contributing

This is an educational project for Lone Star College. For major changes, please open an issue first.

## 📝 License

MIT License - see [LICENSE](LICENSE) file for details

## 👨‍⚕️ Author

**Dr. Victor Garcia M**  
Anatomy & Physiology Instructor  
Lone Star College

---

Built with [Next.js](https://nextjs.org/) | Powered by [Vercel](https://vercel.com)
