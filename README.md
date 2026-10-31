# 🎬 YouTube Watch Party System

### Watch Together. Stay Synchronized. Enjoy Together!

A real-time YouTube Watch Party application that allows multiple users to watch YouTube videos together in a shared room. Create a room, invite friends, synchronize playback, and manage participants with role-based permissions.

<p align="center">
  <img src="https://img.shields.io/badge/React-18-61DAFB?style=for-the-badge&logo=react&logoColor=black" alt="React"/>
  <img src="https://img.shields.io/badge/Node.js-Backend-339933?style=for-the-badge&logo=nodedotjs&logoColor=white" alt="Node.js"/>
  <img src="https://img.shields.io/badge/Socket.IO-Realtime-black?style=for-the-badge&logo=socketdotio" alt="Socket.IO"/>
  <img src="https://img.shields.io/badge/Express.js-Server-lightgrey?style=for-the-badge&logo=express" alt="Express"/>
</p>

---

## 📌 Table of Contents

- [Overview](#-overview)
- [Key Features](#-key-features)
- [User Roles](#-user-roles)
- [Technology Stack](#-technology-stack)
- [Project Architecture](#-project-architecture)
- [Installation](#-installation--setup)
- [How to Use](#-how-to-use)
- [Future Enhancements](#-future-enhancements)

## 🚀 Overview

YouTube Watch Party System is designed to make online video watching a shared experience.

Users can create private watch rooms and invite others using a unique room code. The application uses Socket.IO for real-time communication and the YouTube IFrame Player API for video playback.

The system also includes role-based access control, allowing Hosts and Moderators to manage playback while Participants can request approval for playback actions.

## ✨ Key Features

| Feature | Description |
|---|---|
| 🏠 Room Creation | Create rooms with unique room codes |
| 🔗 Room Joining | Join an existing room using its code |
| ▶️ Playback Sync | Synchronize play, pause and seek actions |
| 🎥 Video Sharing | Change the YouTube video for everyone |
| 👑 Role Management | Host, Moderator and Participant roles |
| 🙋 Approval System | Participants can request playback permission |
| 👥 User Management | Host can assign roles and remove participants |
| ⚡ Real-Time Updates | Live room and participant updates |

## 👥 User Roles

### 👑 Host
- Creates and manages the watch room.
- Controls video playback.
- Assigns or removes Moderator roles.
- Removes participants from the room.
- Approves or rejects playback requests.

### 🛡️ Moderator
- Controls video playback.
- Helps manage the watch session.
- Cannot assign roles or remove participants.

### 🎬 Participant
- Joins rooms using a room code.
- Watches synchronized YouTube videos.
- Sends playback requests for approval.

## 🛠️ Technology Stack

| Technology | Purpose |
|---|---|
| React.js | Frontend user interface |
| Vite | Frontend development and build tool |
| CSS | Styling and layout |
| Node.js | Backend runtime |
| Express.js | Server framework |
| Socket.IO | Real-time communication |
| YouTube IFrame API | YouTube video integration |

## 🏗️ Project Architecture

```text
youtube-watch-party-system/
│
├── client/
│   ├── src/
│   │   ├── App.jsx
│   │   ├── main.jsx
│   │   └── style.css
│   ├── index.html
│   └── package.json
│
├── server/
│   ├── index.js
│   └── package.json
│
├── package.json
├── README.md
└── .gitignore
```

### 🔄 How It Works

1. The Host creates a room.
2. The server generates a unique room code.
3. Participants join using that code.
4. Socket.IO communicates playback events between connected users.
5. The backend validates user permissions.
6. Approved playback actions are broadcast to the room.

## 💻 Installation & Setup

### 1. Clone the Repository

```bash
git clone https://github.com/jyanti-cell/youtube-watch-party-system.git
```

### 2. Open the Project Folder

```bash
cd youtube-watch-party-system
```

### 3. Install Root Dependencies

```bash
npm install
```

### 4. Install Client and Server Dependencies

```bash
npm run install:all
```

### 5. Start the Application

```bash
npm run dev
```

### 6. Open in Browser

```text
http://localhost:5173
```

The frontend runs on port 5173 and the backend runs on port 5000.

## 🎯 How to Use

1. Open the application in your browser.
2. Enter your name.
3. Click **Create New Room** to start a watch party.
4. Share the generated room code with other users.
5. Other users can enter the code and join.
6. Watch YouTube videos together with synchronized playback.
7. Use the role and approval features to manage the session.

## 🔮 Future Enhancements

- User authentication and profiles.
- Group chat during watch sessions.
- Database integration for persistent room information.
- Improved playback synchronization.
- Responsive mobile interface.
- Watch history and saved rooms.

## 🎓 Project Purpose

This project demonstrates practical implementation of:

- Real-time web communication.
- Client-server architecture.
- WebSocket-based event handling.
- API integration.
- Role-based access control.
- React frontend and Node.js backend development.

---

<p align="center">
  <b>Built with ❤️ using React, Node.js and Socket.IO</b>
  <br/>
  <i>YouTube Watch Party System — Watch Together, Anywhere!</i>
</p>
