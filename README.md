# PhysioSync 🦾

**AI-Powered Physiotherapy Application with Real-Time Pose Estimation**

PhysioSync is a full-stack, AI-powered physiotherapy and rehabilitation platform designed to bridge the gap between patients and doctors. Features real-time posture correction via Mediapipe, dynamic personalized exercise plans, and detailed analytics for tracking patient progress.

## 🌟 Key Features

*   **Real-time AI Pose Estimation:** Powered by `@mediapipe/tasks-vision`, providing live feedback and accuracy tracking during exercise sessions.
*   **Dual Dashboard System:**
    *   **Patient Dashboard:** View daily exercise plans, check smart suggestions, monitor weekly trends, download monthly performance reports, and launch exercise sessions.
    *   **Doctor Dashboard:** Manage multiple patients, assign customized exercises, track their compliance, view real-time accuracy and progress reports, and monitor notifications.
*   **Intelligent Exercise Engine:** AI-driven tracking that calculates repetition accuracy locally in the browser to ensure safe exercise routines.
*   **Gamified Patient Experience:** Includes continuous progress tracking, smart UI suggestions, daily rewards logic, and engaging animations.
*   **Secure Healthcare Data:** Utilizes Google Firebase (Auth, Firestore) for stringent Data Security, providing protected routing and custom robust rule sets.
*   **Modern Interactive UI:** Glassmorphism UI built with Tailwind CSS, motion animations, responsive 3D elements, and theming (dark/light mode).

## 🛠 Tech Stack

**Frontend**
*   **React 19**
*   **TypeScript**
*   **Vite** - Rapid development and bundling
*   **Tailwind CSS** - Glassmorphic, highly customized UI
*   **Framer Motion** - Fluid micro-interactions
*   **Zustand** - Global state management
*   **Recharts** - Data visualization and analytic graphs
*   **MediaPipe Vision** - On-device AI tracking
*   **Lucide React** - Iconography
*   **React Webcam** - Camera integration

**Backend & Infrastructure**
*   **Firebase / Firestore** - NoSQL database and attribute-based access control (ABAC) security rules
*   **Firebase Authentication** - Robust secure authentication
*   **Express.js (Vite Middleware)** - Configured production-ready server structure

## 📂 Project Structure

```
.
├── src/
│   ├── components/       # Reusable UI components (Pose Guides, Charts, etc.)
│   ├── pages/            # View components (Dashboards, Exercise Session, etc.)
│   ├── services/         # Mediapipe integration, AI Logic and Service layers
│   ├── store/            # Zustand stores (Auth, Theme)
│   ├── lib/              # Utility functions, helpers
│   ├── App.tsx           # Route configuration and core layout
│   └── main.tsx          # Application entry point
├── server.ts             # Express server setup for full-stack SPA fallback
├── firestore.rules       # Strict Firebase Security Rules
└── package.json          # Dependencies and scripts
```

## 🚀 Getting Started

### Prerequisites
*   Node.js (v18+)
*   Firebase Project setup

### Installation

1.  **Clone the Repository**
2.  **Install Dependencies**
    ```bash
    npm install
    ```
3.  **Configure Environment**
    Create a `.env` file from the example structure or use `firebase-applet-config.json` containing your project details if provisioned automatically.
4.  **Run the Development Server**
    ```bash
    npm run dev
    ```
    The application will start with the Express/Vite server.

## 🔐 Security

PhysioSync employs strict **Firestore Security Rules (Tier-Based Identity & Anti-Update-Gap)**.
Data read and write privileges are rigorously validated to differentiate "Doctor" and "Patient" profiles ensuring healthcare privacy guidelines are fundamentally modeled.

## 💡 Usage

1.  **Register:** Sign up and select the `Patient` or `Doctor` role.
2.  **Doctors:** Add patients using their Patient ID, assign tailored exercise routines, and monitor metrics dynamically.
3.  **Patients:** Navigate to the Exercise Selector, calibrate camera positioning, and perform guided movements. The AI will provide audio cues and repetition counting.
4.  **Insights:** Both portals provide extensive AI-driven analytical dashboards for performance tracking.

---
*Built for accessible and modern remote physiotherapy.*
