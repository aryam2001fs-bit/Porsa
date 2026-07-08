📝 Porsa - Professional Survey Builder

--------------------------

🎯 What is Porsa?

Porsa is a free, open-source, and professional survey/questionnaire builder designed for students, researchers, and educators. Create beautiful, responsive surveys with conditional logic, export data for SPSS analysis, and collect responses — all without writing a single line of code.

--------------------------

✨ Key Features (Feature	Description)

🎨 Glassmorphism UI	Beautiful frosted glass design with animated gradient background

📱 Fully Responsive	Works perfectly on desktop, tablet, and mobile devices

🌙 Dark/Light Mode	Toggle between themes with automatic preference saving

📊 SPSS Export	Export responses as CSV with numeric codes for SPSS analysis

📄 Word Export	Generate printable .doc files of your questionnaires

🔗 Conditional Logic	Show/hide questions based on previous answers

💾 Auto-Save Drafts	Responses are automatically saved as drafts

🔍 Search	Quickly find questionnaires by name or section

🖱️ Drag & Drop	Reorder questions and sections with drag and drop

🔒 Lock Questions	Prevent important questions from being edited or deleted

↩️ Undo (Ctrl+Z)	Revert accidental changes instantly

📈 Statistics	Visual bar charts showing response distribution

🖨️ Print	Clean print-friendly formatting

📤 Import/Export	Import responses from CSV backup files

--------------------------

🚀 Getting Started


Option 1: Use Online (No Installation)

   Visit: https://YOUR_USERNAME.github.io/porsa/

   Click ➕ New Questionnaire to create your first survey

   Add sections and questions

   Share the survey link with respondents
   

Option 2: Install as App

   Desktop: Click the install icon in your browser's address bar

   Android: Open in Chrome → Menu (⋮) → Add to Home Screen

   iOS: Open in Safari → Share → Add to Home Screen


Option 3: Run Locally

   Download all files from this repository
   
   Open index.html in your browser

   That's it! No server or installation required

   --------------------------
   
📋 Question Types Supported

Type	Icon	Description

Short Text	📝	Single-line text input

Long Text	📄	Multi-line textarea

Number	🔢	Numeric input with min/max validation

Single Choice	⭕	Radio buttons (select one)

Multiple Choice	☑️	Checkboxes (select multiple)

Dropdown	📋	Select menu

Likert Scale	📊	5-point agreement scale

Date	📅	Date input (Jalali calendar)

--------------------------

🔗 Conditional Questions
Create smart surveys that adapt based on respondent answers:

   1- Edit a question and check "Show condition"
   
   2- Select the source question (previous question)
   
   3- Choose an operator (equals, not equals, contains)
   
   4- Enter the value (numeric code of the option)
   
Example:

Q1: "Do you smoke?" → Options: Yes (code: 1), No (code: 0)

Q2: "How many cigarettes per day?" → Condition: Show if Q1 equals "1"

--------------------------

📊 Data Export

SPSS Export (CSV)

   Exports numeric codes (not text) for statistical analysis
   Compatible with SPSS, R, Python pandas
   UTF-8 encoded with BOM for Excel compatibility
   
Word Export (.doc)
   Generates printable questionnaire forms
   Includes all questions and options
   Ready for paper-based data collection

--------------------------

🛠️ Technical Details

Aspect	                    Details
Frontend	                  HTML5, CSS3, Vanilla JavaScript
Storage	                   Browser localStorage (no server required)
Offline                    Support	Service Worker for offline access
PWA	                       Installable as Progressive Web App
Size	                      ~50KB (single HTML file)
Dependencies	              None (zero external libraries)
Browser Support	           Chrome, Firefox, Safari, Edge

--------------------------

📁 Project Structure

porsa/
├── index.html          # Main application file
├── style.css           # Styles (Glassmorphism design)
├── app.js              # Application logic
├── sw.js               # Service Worker (offline support)
├── manifest.json       # PWA manifest
├── logo.png            # App icon
└── images/             # UI icons (PNG format)
    ├── search.png
    ├── settings.png
    ├── add.png
    ├── delete.png
    ├── edit.png
    ├── save.png
    ├── check.png
    ├── close.png
    ├── copy.png
    ├── form.png
    ├── chart.png
    ├── home.png
    ├── eye.png
    ├── warning.png
    ├── export.png
    ├── import.png
    ├── print.png
    ├── word.png
    ├── undo.png
    ├── lock.png
    ├── unlock.png
    ├── drag.png
    ├── up.png
    ├── down.png
    ├── empty.png
    ├── book.png
    ├── faq.png
    ├── dev.png
    ├── edu.png
    ├── date.png
    └── email.png

--------------------------

🤝 Contributing
Contributions are welcome! Feel free to:

   Report bugs
   Suggest new features
   Submit pull requests
   Translate to other languages

--------------------------

📜 License

This project is free and open-source. You can use, modify, and distribute it without any restrictions.

--------------------------

👨‍💻 Developer
Aryan Faghih Solaimany

   🎓 Medical Student at Tabriz University of Medical Sciences
   📧 Email: aryam.2001.fs@gmail.com
   📅 Created: Ordibehesht 1405 (April 2026)

--------------------------

🙏 Acknowledgments

   Designed for academic research and student surveys
   Built with ❤️ for the Persian-speaking community

--------------------------
   
⭐ If you find this project useful, please give it a star on GitHub!

--------------------------

Made with ❤️ in Iran 🇮🇷
