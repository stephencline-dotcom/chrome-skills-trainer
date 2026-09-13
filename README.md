# Chrome Skills Trainer

A safe classroom web application built for elementary students to learn and practice Windows desktop and Google Chrome browser window controls.

> **Important Note:** This software is a simulated training environment. It operates entirely within the web page and does not manipulate real computer windows, real operating system settings, or external browser software.

---

## 🌟 Current Features (Phase 1, 2 & 3)

- **Role Selection Landing Page (`/`)**
  - Polished role choice page linking teachers to the Teacher Hub and students to Student Practice.
- **Three Distinct Lesson Views**
  - **Teacher Control** (`teacher.html?skill=minimize&mode=present`) — the *private* view. Shows teacher-only prompts/script, the full lesson-step sidebar, Previous/Next navigation, Replay Demonstration, and Exit Lesson. Never intended to be projected.
  - **Classroom Presentation** (`presentation.html?skill=minimize&lesson=active`) — the *projected* view. Shows only what students should see on the shared screen: a large lesson title, large student-friendly explanation, current step indicator, a restrained "Local Presentation Mode" badge, target-control highlights, and demonstration animations. It contains no teacher prompts, no sidebar, no category filters, and no teacher navigation buttons, and its simulated controls are entirely noninteractive.
  - **Student Practice** (`student.html?skill=minimize&lesson=active`) — the *interactive* simulator each student uses to actually practice clicking Minimize, Maximize, Close, and the taskbar button. Follows Teacher Control by default (Teacher-Led Lesson mode); gains its own Previous/Next navigation only when the teacher turns Independent Mode on.
  - Skills without complete lessons display a clear "Lesson Coming Soon" status in the Teacher Hub catalog.
- **Lesson Delivery Modes (`teacher-led` / `independent`)**
  - Every lesson defaults to **teacher-led**: Teacher Control owns the current step, Classroom Presentation and Student Practice both follow it, and students have no Previous/Next controls.
  - The teacher can flip a labeled **Independent Mode: Off / On** toggle in Teacher Lesson Control. While on, each Student Practice tab gets its own local Previous/Next navigation (still gated by required-step completion) and stops being forced onto the teacher's step. Turning it back off immediately snaps Student Practice back to the teacher's current step.
  - Delivery mode is passed as a plain string field (not a boolean) alongside every synced step, so it can later be sourced from shared classroom state instead of a local toggle.
- **Reusable Lesson Engine (`lesson-engine.js` & `student-lesson.js`)**
  - Shared lesson engine tracking step progression, step completion, and custom event emissions (`lesson:step-changed`, `lesson:step-completed`).
  - Student activity controller connecting `LessonEngine` to `WindowManager` events (`window:minimized`, `window:taskbar-restored`, `window:control-attempt`).
  - Interaction protection disabling non-target controls on observation/guided steps while providing supportive "Try again" feedback.
- **First Complete Lesson: Minimize**
  - Sequence of 8 steps, each with distinct Teacher Control, Classroom Presentation, and Student Practice behavior:
    1. *Meet Minimize*: Introduction to the minus sign button (observation step).
    2. *Find the Button*: Highlighted Minimize button identification.
    3. *Watch It Work*: Demonstration animation showing window sliding to taskbar (replayable from Teacher Control).
    4. *Guided Practice — Minimize*: Practice clicking Minimize to hide window.
    5. *Guided Practice — Bring It Back*: Practice restoring window from taskbar.
    6. *Independent Challenge*: Unguided sequence requiring Minimize followed by Restore (no highlights).
    7. *Minimize or Close?*: Concept-check comparing Minimize and Close (interactive quiz on Student Practice, display-only discussion cards on Classroom Presentation).
    8. *Lesson Complete*: Completion celebration.
- **Simulated Windows & Chrome Window Controls**
  - **Minimize (➖)**, **Maximize (🔲)**, **Restore Down (❐)**, and **Close (❌)** buttons with custom event emission and safe public control methods.
  - Every control also carries a stable `data-simulator-control` attribute (`minimize`, `maximize`, `close`, `chrome-taskbar`) used by a single shared lookup module (`simulator-controls.js`) so target-control highlighting never depends on fragile ids, classes, or button text.
  - Taskbar application button reflecting active, minimized, and closed window states.
  - Title bar double-click toggling maximize/restore down, and restricted title bar dragging within visible desktop workspace bounds.
- **Non-Clipping Target Highlights (`simulator-highlight.js`)**
  - Highlights are rendered as `position: fixed` ring + label overlays appended to `<body>` and repositioned every frame from the target's `getBoundingClientRect()`, instead of a box-shadow class on the button itself.
  - This avoids the previous bug where highlights on corner controls (like Minimize) were invisible: the simulated Chrome window uses `overflow: hidden` for rounded corners, which silently clipped any box-shadow/outline drawn on the button when it extended past the window's edges.
  - The overlay uses `pointer-events: none` so it never blocks clicking, stays visible even when the control has `.control-disabled` styling, and respects `prefers-reduced-motion`.
- **Shared "Watch It Work" Demonstration (`minimize-demonstration.js`)**
  - A single reusable controller drives a simulated cursor that moves to Minimize, clicks, minimizes the window, moves to the taskbar button, clicks, and restores it - used identically by Classroom Presentation, Teacher Lesson Control's mini preview, and Student Practice Step 3, so all three are always in sync and never separately timed.
  - Respects `prefers-reduced-motion` by skipping the cursor travel animation while still showing each stage and the click indicator.

---

## 🖥️ Three-View Architecture

Chrome Skills Trainer Phase 3 has three distinct, purpose-built views:

| View | File | Audience | Contains |
|---|---|---|---|
| **Teacher Control** | `teacher.html?skill=...&mode=present` | Teacher only (never projected) | Teacher prompts/script, full step sidebar, Previous/Next, Replay Demonstration, Exit Lesson, launch buttons for the other two views |
| **Classroom Presentation** | `presentation.html?skill=...&lesson=active` | Projected for the whole class | Large title/explanation, step indicator, target highlights, demonstration animations, restrained "Local Presentation Mode" badge — no teacher notes, no sidebar, no teacher nav |
| **Student Practice** | `student.html?skill=...&lesson=active` | Each student's own device/browser | The fully interactive simulator with real click handling and completion tracking |

Teacher notes and prompts are **never** intended to appear on the Classroom Presentation screen.

### Local (Same-Browser) Tab Synchronization

`public/scripts/local-lesson-channel.js` uses the browser `BroadcastChannel` API (channel name `chrome-skills-trainer-local-lesson-sync-v1`) so a Teacher Control tab and its followers - a Classroom Presentation tab and/or a Student Practice tab - **open in the same browser** stay in sync:

- Teacher Control publishes `set-step` (with `skillId`, `stepId`, `stepIndex`, `deliveryMode`) whenever the active step changes, `set-delivery-mode` when Independent Mode is toggled, and `replay-demonstration` when the teacher clicks Replay Demonstration on Step 3.
- **Handshake:** a follower announces itself with `follower-ready` as soon as it loads. Teacher Control responds with `teacher-state`, the complete current state. A follower only shows itself as "Connected" after receiving that reply - simply having `BroadcastChannel` available is not treated as "connected". If Teacher Control isn't open yet, the follower shows a clear "Waiting for Teacher Control…" status instead of guessing Step 1.
- If `BroadcastChannel` is unavailable in the browser, Classroom Presentation and Student Practice still load their first lesson step and display a status message explaining that live local following is unavailable.

**This is explicitly local, same-browser-only presentation preview support.** It is not the future remote classroom synchronization system, does not use Firebase/WebSockets/accounts, and must not be read as representing or preparing real multi-device student synchronization — see the roadmap below.

---

## 📁 Project Structure

```
chrome-skills-trainer/
├── package.json               # Node.js package configuration & dependencies
├── server.js                 # Express server with role routing (/teacher, /student, /presentation)
├── README.md                 # Documentation, setup, and future sync specifications
└── public/
    ├── index.html            # Role selection landing page
    ├── teacher.html          # Teacher Hub & Teacher Control (private) page
    ├── presentation.html     # Classroom Presentation (projected) page
    ├── student.html          # Student Practice simulator page
    ├── data/
    │   └── skills.json       # Single source of truth for skills & lesson steps
    ├── styles/
    │   ├── base.css          # Core CSS variables, resets, focus rings, reduced motion
    │   ├── desktop.css       # Desktop wallpaper, taskbar, & instruction card styles
    │   ├── browser.css       # Chrome window, toolbar, tabs, & content styles
    │   ├── lesson-hub.css    # Teacher hub grid, filters, & detail panel styles
    │   ├── lesson-player.css # Teacher slides, target-highlight overlay, quiz, & preview nav styles
    │   └── presentation.css  # Classroom Presentation header & step-specific overlay panels
    └── scripts/
        ├── lesson-catalog.js        # Shared ES module for fetching & querying skills.json
        ├── lesson-engine.js         # Shared state engine for step navigation & completion tracking
        ├── student-lesson.js        # Student activity controller connecting Engine to WindowManager
        ├── lesson-hub.js             # Controller for Teacher Hub UI & Teacher Control mode
        ├── presentation.js           # Controller for the Classroom Presentation (projected) view
        ├── window-manager.js        # State, positioning, dragging, events & public control methods
        ├── simulator-controls.js    # Shared data-simulator-control lookup mapping
        ├── simulator-highlight.js   # Shared non-clipping target-control highlight overlay
        ├── local-lesson-channel.js  # Local (same-browser) Teacher Control <-> Presentation sync
        └── app.js                   # Entry point for student simulator & lesson mode router
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
   - Teacher Control: `http://localhost:3000/teacher.html?skill=minimize&mode=present`
   - Classroom Presentation: `http://localhost:3000/presentation.html?skill=minimize&lesson=active` (or `/presentation`)
   - Student Practice: `http://localhost:3000/student.html?skill=minimize&lesson=active&preview=teacher`

   For live local sync, open Teacher Control and Classroom Presentation in two tabs of the **same browser** and step through the lesson from Teacher Control.

---

## 🔄 Future Synchronization Architecture Specification

In future phases, Chrome Skills Trainer will support real-time teacher-led classroom instruction where a teacher presentation controls synchronized student devices over a remote/shared backend. Note: Firebase, WebSockets, authentication, student accounts, remote synchronization, and Freeze Screen are planned for future phases and are **not** implemented in Phase 3. The Phase 3 `BroadcastChannel`-based local sync described above is a local-preview convenience only and is a separate, unrelated mechanism from this future system.

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

- Executed `node --check` across all JS files (`server.js`, `lesson-catalog.js`, `lesson-engine.js`, `student-lesson.js`, `lesson-hub.js`, `presentation.js`, `window-manager.js`, `simulator-controls.js`, `simulator-highlight.js`, `local-lesson-channel.js`, `app.js`).
- Validated `skills.json` JSON structure.
- Verified all Express routes (`/`, `/teacher`, `/student`, `/presentation`, `/teacher.html`, `/student.html`, `/presentation.html`).
- Verified with a real headless Chromium browser (Playwright) that:
  - Teacher Control opens Classroom Presentation in a separate tab and both stay in sync as steps change.
  - Steps 1–8 render the correct projected content on Classroom Presentation, including the Step 3 demonstration and repeatable Replay Demonstration.
  - Student Practice Step 2, 4, and 5 target highlights are visible and correctly positioned over the real Minimize/taskbar buttons; Step 6 shows no highlight.
  - No console errors occur, and neither Teacher Control nor Classroom Presentation exhibits whole-page scrolling at a 1366×768 viewport.

