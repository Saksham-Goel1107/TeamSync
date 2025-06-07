# TeamSync

<p align="center">
  <img src="client/public/images/workspace.jpg" alt="TeamSync Banner" width="600">
</p>

> A modern, full-stack workspace collaboration platform built with React, Node.js, and MongoDB.

[![License](https://img.shields.io/github/license/Saksham-Goel1107/TeamSync)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0.4-blue.svg)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-18.2.0-61dafb.svg)](https://reactjs.org/)
[![Node.js](https://img.shields.io/badge/Node.js-18.x-green.svg)](https://nodejs.org/)
[![MongoDB](https://img.shields.io/badge/MongoDB-6.x-green.svg)](https://www.mongodb.com/)
[![Express](https://img.shields.io/badge/Express-4.21.2-lightgrey.svg)](https://expressjs.com/)
[![TailwindCSS](https://img.shields.io/badge/TailwindCSS-3.x-38bdf8.svg)](https://tailwindcss.com/)
[![Vite](https://img.shields.io/badge/Vite-5.x-646cff.svg)](https://vitejs.dev/)
[![Code Style](https://img.shields.io/badge/code_style-prettier-ff69b4.svg)](https://prettier.io/)

## 🚀 Features

### 🏢 Workspace Management
- Create and manage multiple workspaces
- Invite team members with customizable access roles
- Transfer workspace ownership
- Real-time workspace analytics
- Secure workspace access controls

### 👥 Team Collaboration
- Role-based access control (Owner, Admin, Member)
- Member management with customizable permissions
- Real-time member status and activity tracking
- Seamless team communication

### 📊 Project Management
- Create and organize projects within workspaces
- Project analytics and progress tracking
- Custom project emojis and descriptions
- Project-specific task management

### ✅ Task Management
- Comprehensive task tracking system
- Priority levels (Low, Medium, High, Urgent)
- Task status workflow (Todo, In Progress, Done)
- Due date management
- Task assignments and reassignments
- Task filtering and sorting capabilities

### 📈 Analytics Dashboard
- Workspace-level analytics
- Project-specific performance metrics
- Task completion statistics
- Overdue task tracking
- Team productivity insights

## 🛠️ Tech Stack

### Frontend
- **Framework**: React with TypeScript
- **Routing**: React Router v6
- **State Management**: TanStack Query (React Query)
- **Styling**: Tailwind CSS + Shadcn UI
- **Form Handling**: React Hook Form + Zod
- **Date Handling**: date-fns
- **Icons**: Lucide React

### Backend
- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: MongoDB with Mongoose
- **Authentication**: Passport.js (Local + Google OAuth)
- **API Validation**: Zod
- **Security**: bcrypt for password hashing
- **Session Management**: cookie-session

## 🏗️ Project Structure

```
TeamSync/
├── LICENSE
├── README.md
├── backend/                # Backend server application
│   ├── package.json
│   ├── tsconfig.json
│   └── src/
│       ├── index.ts       # Entry point
│       ├── @types/       # TypeScript declarations
│       ├── config/       # App configurations
│       │   ├── app.config.ts
│       │   ├── database.config.ts
│       │   ├── http.config.ts
│       │   └── passport.config.ts
│       ├── controllers/  # Request handlers
│       ├── enums/       # Type enumerations
│       ├── middlewares/ # Express middlewares
│       ├── models/      # MongoDB models
│       ├── routes/      # API routes
│       ├── seeders/     # Database seeders
│       ├── services/    # Business logic
│       ├── utils/       # Helper utilities
│       └── validation/  # Request validation
└── client/              # Frontend React application
    ├── components.json
    ├── package.json
    ├── tsconfig.json
    ├── vite.config.ts
    ├── public/
    │   └── images/
    └── src/
        ├── App.tsx
        ├── main.tsx
        ├── assets/     # Static assets
        ├── components/ # React components
        │   ├── asidebar/
        │   ├── auth/
        │   ├── ui/
        │   └── workspace/
        ├── context/    # React contexts
        ├── hooks/      # Custom React hooks
        ├── lib/        # Utility functions
        ├── pages/      # Page components
        ├── routes/     # Route definitions
        └── types/      # TypeScript types
```

## 🚀 Getting Started

### Prerequisites
- Node.js (v16 or higher)
- MongoDB (v6.0 or higher)
- npm (v8 or higher) or yarn (v1.22 or higher)
- TypeScript (v5.0 or higher)

### Environment Requirements
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D16.0.0-brightgreen.svg)](https://nodejs.org)
[![MongoDB Version](https://img.shields.io/badge/mongodb-%3E%3D6.0.0-brightgreen.svg)](https://www.mongodb.com)
[![TypeScript Version](https://img.shields.io/badge/typescript-%3E%3D5.0.0-blue.svg)](https://www.typescriptlang.org)
[![NPM Version](https://img.shields.io/badge/npm-%3E%3D8.0.0-red.svg)](https://www.npmjs.com)

### Installation

1. Clone the repository
```bash
git clone https://github.com/Saksham-Goel1107/TeamSync.git
cd TeamSync
```

2. Install backend dependencies
```bash
cd backend
npm install
```

3. Install frontend dependencies
```bash
cd client
npm install
```

4. Set up environment variables
Create `.env` files in both backend and client directories based on the provided examples.

5. Start the development servers

Backend:
```bash
cd backend
npm run dev
```

Frontend:
```bash
cd client
npm run dev
```

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 👨‍💻 Author

**Saksham Goel**
- GitHub: [@Saksham-Goel1107](https://github.com/Saksham-Goel1107)

## 🙏 Acknowledgments

- Thanks to all contributors who participated in this project
- Special thanks to the open-source community for the amazing tools and libraries

---

<p align="center">Made with ❤️ by Saksham Goel</p>
