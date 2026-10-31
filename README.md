# 🎬 YouTube Watch Party System

### Watch Together. Stay Synchronized. Enjoy Together!

A real-time YouTube Watch Party application that allows multiple users to watch YouTube videos together in a shared room.

## ✨ Key Features

- Create watch party rooms with unique room codes.
- Join rooms using a room code.
- Synchronize YouTube playback.
- Host can assign Moderator roles.
- Host can remove participants.
- Moderators can control playback.
- Participants can request playback approval.
- Real-time communication using Socket.IO.

## 👥 User Roles

- **Host:** Creates rooms, manages participants and assigns roles.
- **Moderator:** Controls video playback.
- **Participant:** Watches videos and requests playback permissions.

## 🛠️ Technology Stack

| Technology | Purpose |
|---|---|
| React.js | Frontend |
| Vite | Development and build tool |
| CSS | Styling |
| Node.js | Backend runtime |
| Express.js | Server |
| Socket.IO | Real-time communication |
| YouTube IFrame API | Video playback |

## 🏗️ Project Structure

```text
youtube-watch-party-system/
├── client/
│   ├── src/
│   │   ├── app.jsx
│   │   ├── main.jsx
│   │   └── style.css
│   ├── index.html
│   └── package.json
├── server/
│   ├── index.js
│   └── package.json
├── package.json
├── README.md
└── .gitignore
```

## 💻 Installation & Setup

### 1. Clone the repository

```bash
git clone https://github.com/jyanti-cell/youtube-watch-party-system.git
cd youtube-watch-party-system
```

### 2. Install dependencies

```bash
npm run install:all
```

### 3. Start the application

```bash
npm run dev
```

### 4. Open in browser

Frontend: `http://localhost:5173`

Backend: `http://localhost:5000`

## 🔄 How It Works

1. Host creates a watch party room.
2. Server generates a unique room code.
3. Participants join using the code.
4. Socket.IO shares playback events in real time.
5. Backend validates user permissions.
6. Approved actions are synchronized across the room.

## 🔮 Future Enhancements

- User authentication.
- Group chat.
- Database integration.
- Improved playback synchronization.
- Responsive mobile interface.
- Watch history and saved rooms.

## 🎓 Project Purpose

This project demonstrates real-time communication, client-server architecture, API integration, role-based access control and full-stack web development.

---

**Built with React, Node.js and Socket.IO.**
