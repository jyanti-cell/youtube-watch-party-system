
# YouTube Watch Party System

A real-time web application where multiple users can watch YouTube videos together.

## Features

- Create a watch party room.
- Join a room using a unique room code.
- Synchronize YouTube video playback.
- Host can assign Moderator roles.
- Host can remove participants.
- Moderators can control playback.
- Participants can request playback actions.
- Real-time communication using Socket.IO.

## Technology Stack

- React.js
- Node.js
- Express.js
- Socket.IO
- YouTube IFrame Player API
- CSS

## Project Structure

- client: Frontend application
- server: Backend and WebSocket server

## Installation

Install dependencies:

npm run install:all

## Run the Project

npm run dev

Frontend: http://localhost:5173

Backend: http://localhost:5000

## Architecture

React frontend communicates with the Node.js backend using Socket.IO.
The backend manages rooms, user roles, permissions and playback events.
YouTube IFrame API is used to play videos.
