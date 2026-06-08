/**
 * PDF Export Module
 * Generates detailed performance reports using jsPDF
 */

export async function exportResultsPdf({ student, email, section, examDate, course, scoreData }) {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'pt', format: 'letter' });
  const margin = 42;
  const pageWidth = doc.internal.pageSize.getWidth();
  const width = pageWidth - margin * 2;
  let y = margin;

  function addPage() {
    doc.addPage();
    y = margin;
  }

  function line(text, size = 10, bold = false, color = [40, 40, 40]) {
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.setFontSize(size);
    doc.setTextColor(...color);
    const parts = doc.splitTextToSize(String(text), width);
    for (const part of parts) {
      if (y > 730) addPage();
      doc.text(part, margin, y);
      y += size + 5;
    }
  }

  function gap(px = 8) { y += px; }

  function hrule() {
    if (y > 730) addPage();
    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.5);
    doc.line(margin, y, pageWidth - margin, y);
    y += 10;
  }

  // Header
  line(course.label || 'Lab Practical Exam', 18, true, [15, 118, 110]);
  line('Performance Report', 14, true);
  gap(4);
  hrule();

  // Student info
  line(`Student: ${student}`, 11, true);
  line(`Email: ${email}`, 11);
  line(`Section: ${section}`, 11);
  line(`Exam Date: ${examDate}`, 11);
  line(`Report Generated: ${new Date().toLocaleString()}`, 11);
  gap(6);

  // Score
  const scoreColor = scoreData.percent >= 70 ? [4, 120, 87] : [185, 28, 28];
  line(`Score: ${scoreData.correct} / ${scoreData.total} (${scoreData.percent}%)`, 16, true, scoreColor);
  gap(4);
  hrule();

  // Missed questions
  line('Missed Questions', 14, true);
  gap(4);

  if (!scoreData.missed.length) {
    line('No missed questions. Excellent work!', 11, false, [4, 120, 87]);
  } else {
    scoreData.missed.forEach((q, i) => {
      gap(4);
      line(`Station ${q.s} · Question ${q.q} (${q.bloom})`, 11, true);
      line(q.question, 10);
      line(`Your answer: ${q.selectedAnswer}`, 10, false, [185, 28, 28]);
      line(`Correct answer: ${q.answer}. ${q.options[q.answer]}`, 10, false, [4, 120, 87]);
      line(`Learning Objective: ${q.lo}`, 10);
      line(`Rationale: ${q.rationale}`, 10, false, [100, 100, 100]);
      if (i < scoreData.missed.length - 1) {
        gap(2);
        hrule();
      }
    });
  }

  // Footer
  gap(12);
  hrule();
  line('Built by Dr. Victor Garcia M · Station Exam Builder', 9, false, [150, 150, 150]);

  // Save
  const safeName = student.replace(/[^a-z0-9]+/gi, '_').replace(/^_+|_+$/g, '') || 'Student';
  doc.save(`${course.code}_Report_${safeName}.pdf`);
}
