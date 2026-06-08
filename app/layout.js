import './globals.css';

export const metadata = {
  title: 'Station Exam Builder — A&P Lab Practical',
  description: 'Station-based study and exam tool for Anatomy & Physiology lab practical exams. Practice with 105 questions across 28 stations with immediate feedback, rationale, and ADA-compliant visuals.',
  keywords: 'anatomy, physiology, lab practical, exam, study, station, BIOL 2401, BIOL 2402',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600;9..144,700;9..144,900&family=Outfit:wght@400;500;600;700;900&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <div className="bg-pattern" aria-hidden="true" />
        {children}
      </body>
    </html>
  );
}
