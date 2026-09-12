# Chrome Skills Trainer

A safe classroom web application built for elementary students to learn and practice Windows desktop and Google Chrome browser window controls.

> **Important Note:** This software is a simulated training environment. It operates entirely within the web page and does not manipulate real computer windows, real operating system settings, or external browser software.

---

## 🌟 Current Features (Phase 1, 2 & 3)

- **Role Selection Landing Page (`/`)**
  - Polished role choice page linking teachers to the Teacher Presentation Hub and students to Student Practice.
- **Teacher Skill Hub & Presentation Mode (`/teacher`)**
  - Data-driven catalog rendering 19 Chrome skills across 5 categories: Window Controls, Navigation, Tabs, Bookmarks, and Chrome Menu.
  - Interactive Teacher Presentation Mode (`teacher.html?skill=minimize&mode=present`):
    - Projection-ready presentation slides with teacher prompts, student previews, step sidebar, and Replay Demonstration animation for Step 3.
    - "Open Student Preview" button launching `student.html?skill=minimize&lesson=active&preview=teacher` in a new tab.
    - "Exit Lesson" button returning to catalog.
  - Skills without complete lessons display a clear "Lesson Coming Soon" status.
- **Reusable Lesson Engine (`lesson-engine.js` & `student-lesson.js`)**
  - Shared lesson engine tracking step progression, step completion, and custom event emissions (`lesson:step-changed`, `lesson:step-completed`).
  - Student activity controller connecting `LessonEngine` to `WindowManager` events (`window:minimized`, `window:taskbar-restored`, `window:control-attempt`).
  - Interaction protection disabling non-target controls on observation/guided steps while providing supportive "Try again" feedback.
- **First Complete Lesson: Minimize**
  - Sequence of 8 interactive steps:
    1. *Meet Minimize*: Introduction to the minus sign button (observation step).
    2. *Find the Button*: Highlighted Minimize button identification.
    3. *Watch It Work*: Demonstration animation showing window sliding to taskbar.
    4. *Guided Practice — Minimize*: Practice clicking Minimize to hide window.
    5. *Guided Practice — Bring It Back*: Practice restoring window from taskbar.
    6. *Independent Challenge*: Unguided sequence requiring Minimize followed by Restore.
    7. *Minimize or Close?*: Quiz step choosing between Minimize and Close.
    8. *Lesson Complete*: Completion celebration and Return to Skill Hub.
- **Simulated Windows & Chrome Window Controls**
  - **Minimize (➖)**, **Maximize (🔲)**, **Restore Down (❐)**, and **Close (❌)** buttons with custom event emission and safe public control methods.
  - Taskbar application button reflecting active, minimized, and closed window states.
  - Title bar double-click toggling maximize/restore down, and restricted title bar dragging within visible desktop workspace bounds.

---

## 📁 Project Structure

```
chrome-skills-trainer/
├── package.json               # Node.js package configuration & dependencies
├── server.js                 # Express server with role routing (/teacher, /student)
├── README.md                 # Documentation, setup, and future sync specifications
└── public/
    ├── index.html            # Role selection landing page
    ├── teacher.html          # Teacher presentation skill hub page
    ├── student.html          # Student simulator practice page
    ├── data/
    │   └── skills.json       # Single source of truth for skills & lesson steps
    ├── styles/
    │   ├── base.css          # Core CSS variables, resets, focus rings, reduced motion
    │   ├── desktop.css       # Desktop wallpaper, taskbar, & instruction card styles
    │   ├── browser.css       # Chrome window, toolbar, tabs, & content styles
    │   ├── lesson-hub.css    # Teacher hub grid, filters, & detail panel styles
    │   └── lesson-player.css # Presentation slides, target highlights, quiz, & preview nav styles
    └── scripts/
        ├── lesson-catalog.js # Shared ES module for fetching & querying skills.json
        ├── lesson-engine.js  # Shared state engine for step navigation & completion tracking
        ├── student-lesson.js # Student activity controller connecting Engine to WindowManager
        ├── lesson-hub.js     # Controller for Teacher Skill Hub UI & Presentation Mode
        ├── window-manager.js # State, positioning, dragging, events & public control methods
        └── app.js            # Entry point for student simulator & lesson mode router
```

---

## 🚀 Setup & Running Instructions

### Prerequisites
- Node.js (v18 or higher recommended)
- npm

### Installation & Execution

1. Install dependencies:
   ```bash
   npm install
   ```

2. Start the local server:
   ```bash
   npm start
   ```

3. Open your browser and navigate to any of the supported routes:
   - Root / Role Selection: `http://localhost:3000/`
   - Teacher Hub: `http://localhost:3000/teacher` (or `http://localhost:3000/teacher.html`)
   - Teacher Presentation Mode: `http://localhost:3000/teacher.html?skill=minimize&mode=present`
   - Student Simulator Practice: `http://localhost:3000/student.html?skill=minimize&lesson=active&preview=teacher`

---

## 🔄 Future Synchronization Architecture Specification

In future phases, Chrome Skills Trainer will support real-time teacher-led classroom instruction where a teacher presentation controls synchronized student devices. Note: Real-time synchronization, Firebase, WebSockets, accounts, and Freeze Screen are planned for future phases and not currently implemented in Phase 3 Local Preview Mode.

### Planned Shared Classroom State
The shared session object will manage real-time session synchronization with fields similar to:

- `lessonId`: ID of the active skill/lesson selected by the teacher (e.g., `"minimize"`).
- `currentStep`: Current active step/section index (0 to 7).
- `activityId`: Specific student activity identifier currently active.
- `teacherPresent`: Boolean indicating if a teacher is currently connected and hosting the session.
- `teacherControlEnabled`: Boolean controlling whether student devices auto-follow teacher presentation navigation.
- `freezeScreenArmed`: Boolean flag that locks all student device interactions during teacher instruction.

### Required Future Synchronization Rules
1. **Teacher Authority**: The teacher selects and controls the active shared lesson and current presentation step.
2. **Student Device Follow**: Student devices automatically follow the teacher-selected skill and active step in real time.
3. **Role Separation**: Presentation slides and teacher control panels appear on the teacher side, while practice activities and simulators appear on the student side.
4. **Student State Protection**: Students cannot modify shared classroom session state.
5. **Freeze Screen Interception**: When `freezeScreenArmed` is `true`, an overlay on student devices intercepts all mouse, click, scroll, touch, and keyboard events before any simulator or lesson behavior occurs.
6. **Clean Logout Teardown**: Teacher logout must explicitly set `freezeScreenArmed` to `false` before destroying the teacher session and redirecting.

---

## 🧪 Verification & Testing

- Executed `node --check` across all JS files (`server.js`, `lesson-catalog.js`, `lesson-engine.js`, `student-lesson.js`, `lesson-hub.js`, `window-manager.js`, `app.js`).
- Validated `skills.json` JSON structure.
- Verified all Express routes (`/`, `/teacher`, `/student`, `/teacher.html`, `/student.html`).
- Verified Teacher Presentation Mode (`teacher.html?skill=minimize&mode=present`) step navigation, sidebar jumps, Replay Demonstration animation, and Student Preview link.
- Verified Student Lesson Mode (`student.html?skill=minimize&lesson=active&preview=teacher`) step 1 through 8, target highlighting, interaction protection, quiz step 7, challenge step 6, and completion state.
