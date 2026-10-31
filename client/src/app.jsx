
import React, { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import "./style.css";

const SERVER_URL = "https://youtube-watch-party-system-2.onrender.com";

let socket;

function App() {
  const [name, setName] = useState("");
  const [roomCode, setRoomCode] = useState("");
  const [activeRoom, setActiveRoom] = useState(false);
  const [role, setRole] = useState("Participant");
  const [users, setUsers] = useState([]);
  const [requests, setRequests] = useState([]);
  const [videoId, setVideoId] = useState("jfKfPfyJRdk");
  const [videoInput, setVideoInput] = useState("");
  const [playing, setPlaying] = useState(false);
  const [message, setMessage] = useState("");
  const [playerReady, setPlayerReady] = useState(false);

  const playerRef = useRef(null);
  const currentRoomRef = useRef("");

  const isHost = role === "Host";
  const canControl = role === "Host" || role === "Moderator";

  useEffect(() => {
    socket = io(SERVER_URL);

    socket.on("connect", () => {
      console.log("Connected to server:", socket.id);
      setMessage("Connected to server!");
    });

    socket.on("connect_error", (error) => {
      console.error("Connection error:", error.message);
      setMessage("Server connection failed!");
    });

    socket.on("room_created", (data) => {
      console.log("Room created:", data);
      enterRoom(data);
    });

    socket.on("room_joined", (data) => {
      enterRoom(data);
    });

    socket.on("room_users", (data) => {
      setUsers(data.users || []);
    });

    socket.on("user_joined", (data) => {
      setUsers(data.users || []);
    });

    socket.on("user_left", (data) => {
      setUsers(data.users || []);
    });

    socket.on("playback_updated", (data) => {
      if (data.videoId) {
        setVideoId(data.videoId);
      }

      if (playerRef.current) {
        if (data.action === "play") {
          playerRef.current.playVideo();
        } else if (data.action === "pause") {
          playerRef.current.pauseVideo();
        } else if (data.action === "seek") {
          playerRef.current.seekTo(data.currentTime || 0, true);
        } else if (data.action === "change_video") {
          playerRef.current.loadVideoById(data.videoId);
        }
      }

      if (data.action === "play") setPlaying(true);
      if (data.action === "pause") setPlaying(false);
    });

    socket.on("role_updated", (data) => {
      if (data.userId === socket.id) {
        setRole(data.role);
      }
      setUsers(data.users || []);
    });

    socket.on("action_requested", (data) => {
      setRequests(data.requests || []);
    });

    socket.on("request_updated", (data) => {
      setRequests(data.requests || []);
    });

    socket.on("participant_removed", () => {
      setActiveRoom(false);
      setUsers([]);
      setRequests([]);
      setMessage("You were removed from the room.");
    });

    socket.on("error_message", (data) => {
      setMessage(data.message || "Something went wrong.");
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  function enterRoom(data) {
    const code = data.roomCode || data.code || roomCode;

    currentRoomRef.current = code;
    setRoomCode(code);
    setActiveRoom(true);
    setRole(data.role || "Participant");
    setUsers(data.users || []);
    setRequests(data.requests || []);
    setVideoId(data.videoId || "jfKfPfyJRdk");
    setMessage("");
  }

  function createRoom() {
    if (!name.trim()) {
      setMessage("Please enter your name.");
      return;
    }

    if (!socket || !socket.connected) {
      setMessage("Server is not connected. Please wait.");
      return;
    }

    socket.emit("create_room", {
      name: name.trim()
    });
  }

  function joinRoom() {
    if (!name.trim() || !roomCode.trim()) {
      setMessage("Enter your name and room code.");
      return;
    }

    if (!socket || !socket.connected) {
      setMessage("Server is not connected. Please wait.");
      return;
    }

    socket.emit("join_room", {
      name: name.trim(),
      roomCode: roomCode.trim().toUpperCase()
    });
  }

  function playbackAction(action, extra = {}) {
    if (!activeRoom) return;

    if (!canControl) {
      socket.emit("request_action", {
        roomCode: currentRoomRef.current,
        action,
        ...extra
      });

      setMessage("Request sent to the Host.");
      return;
    }

    socket.emit("playback_action", {
      roomCode: currentRoomRef.current,
      action,
      ...extra
    });
  }

  function changeVideo() {
    const match = videoInput.match(
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&?/]+)/
    );

    const id = match ? match[1] : videoInput.trim();

    if (!id) {
      setMessage("Please enter a valid YouTube video URL or ID.");
      return;
    }

    setVideoId(id);
    playbackAction("change_video", { videoId: id });
    setVideoInput("");
  }

  function assignModerator(userId) {
    socket.emit("assign_role", {
      roomCode: currentRoomRef.current,
      userId,
      role: "Moderator"
    });
  }

  function removeUser(userId) {
    socket.emit("remove_participant", {
      roomCode: currentRoomRef.current,
      userId
    });
  }

  function approveRequest(requestId, approved) {
    socket.emit("approve_request", {
      roomCode: currentRoomRef.current,
      requestId,
      approved
    });
  }

  function leaveRoom() {
    socket.emit("leave_room", {
      roomCode: currentRoomRef.current
    });

    setActiveRoom(false);
    setUsers([]);
    setRequests([]);
    setRole("Participant");
    currentRoomRef.current = "";
  }

  function copyInvite() {
    navigator.clipboard.writeText(
      `${window.location.origin}?room=${currentRoomRef.current}`
    );

    setMessage("Invite link copied!");
  }

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const invitedRoom = params.get("room");

    if (invitedRoom) {
      setRoomCode(invitedRoom);
    }
  }, []);

  useEffect(() => {
    if (!activeRoom) return;

    if (window.YT && window.YT.Player) {
      initializePlayer();
      return;
    }

    if (!document.getElementById("youtube-api")) {
      const script = document.createElement("script");
      script.id = "youtube-api";
      script.src = "https://www.youtube.com/iframe_api";
      document.body.appendChild(script);
    }

    window.onYouTubeIframeAPIReady = () => {
      initializePlayer();
    };

    return () => {
      window.onYouTubeIframeAPIReady = null;
    };
  }, [activeRoom]);

  function initializePlayer() {
    if (!window.YT || !window.YT.Player || playerRef.current) return;

    playerRef.current = new window.YT.Player("youtube-player", {
      height: "390",
      width: "100%",
      videoId,

      playerVars: {
        autoplay: 0,
        controls: 1,
        rel: 0
      },

      events: {
        onReady: () => {
          setPlayerReady(true);
        },

        onStateChange: (event) => {
          if (event.data === window.YT.PlayerState.PLAYING) {
            setPlaying(true);
          }

          if (event.data === window.YT.PlayerState.PAUSED) {
            setPlaying(false);
          }
        }
      }
    });
  }

  useEffect(() => {
    if (!playerReady || !playerRef.current) return;

    playerRef.current.loadVideoById(videoId);
  }, [videoId, playerReady]);

  const displayUsers = users.length
    ? users
    : [{ id: socket?.id, name, role }];

  if (!activeRoom) {
    return (
      <div className="app">
        <nav className="navbar">
          <div className="brand">
            <span className="brand-icon">▶</span>
            Watch<span>Party</span>
          </div>

          <span className="nav-label">WATCH TOGETHER</span>
        </nav>

        <main className="home">
          <div className="hero">
            <div className="hero-tag">YOUR PRIVATE WATCH SPACE</div>

            <h1>
              Watch Together.
              <br />
              <span>Stay Connected.</span>
            </h1>

            <p>
              Create a room, invite your friends and enjoy YouTube
              videos together in real time.
            </p>
          </div>

          <div className="entry-card">
            <h2>Start Your Watch Party</h2>

            <p className="muted">
              Enter your details to get started.
            </p>

            <label>Your Name</label>

            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter your name"
            />

            <button
              className="primary-btn"
              onClick={createRoom}
            >
              + Create New Room
            </button>

            <div className="separator">
              <span>OR JOIN EXISTING ROOM</span>
            </div>

            <label>Room Code</label>

            <input
              value={roomCode}
              onChange={(e) =>
                setRoomCode(e.target.value.toUpperCase())
              }
              placeholder="Enter room code"
            />

            <button
              className="secondary-btn"
              onClick={joinRoom}
            >
              Join Watch Party →
            </button>

            {message && (
              <p className="message">{message}</p>
            )}
          </div>

          <div className="features">
            <div className="feature">
              <span>🎬</span>
              <h3>Synced Playback</h3>
              <p>Watch videos together.</p>
            </div>

            <div className="feature">
              <span>👥</span>
              <h3>Private Rooms</h3>
              <p>Invite people with a code.</p>
            </div>

            <div className="feature">
              <span>⚡</span>
              <h3>Real-time</h3>
              <p>Stay in sync with everyone.</p>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="app">
      <nav className="navbar">
        <div className="brand">
          <span className="brand-icon">▶</span>
          Watch<span>Party</span>
        </div>

        <div className="room-info">
          <span>ROOM</span>
          <strong>{roomCode}</strong>

          <button onClick={copyInvite}>
            Copy Invite
          </button>
        </div>

        <button
          className="leave-btn"
          onClick={leaveRoom}
        >
          Leave Room
        </button>
      </nav>

      <main className="dashboard">
        <div className="dashboard-heading">
          <div>
            <div className="hero-tag">LIVE WATCH PARTY</div>
            <h1>You're watching together.</h1>
          </div>

          <span className="live-indicator">● LIVE</span>
        </div>

        {message && (
          <div className="message">{message}</div>
        )}

        <div className="watch-layout">
          <section className="player-section">
            <div className="section-heading">
              <h2>Now Playing</h2>
              <span className="role-pill">{role}</span>
            </div>

            <div className="player-box">
              <div id="youtube-player"></div>
            </div>

            <div className="video-tools">
              <input
                value={videoInput}
                onChange={(e) => setVideoInput(e.target.value)}
                placeholder="Paste YouTube video URL or ID"
              />

              <button
                onClick={changeVideo}
                disabled={!canControl}
              >
                Change Video
              </button>
            </div>

            <div className="controls">
              <button
                onClick={() => playbackAction("play")}
              >
                ▶ Play
              </button>

              <button
                onClick={() => playbackAction("pause")}
              >
                ⏸ Pause
              </button>

              <button
                onClick={() =>
                  playbackAction("seek", {
                    currentTime:
                      playerRef.current?.getCurrentTime() || 0
                  })
                }
              >
                Sync Position
              </button>
            </div>

            {!canControl && (
              <p className="muted">
                You are a participant. Request approval for playback actions.
              </p>
            )}
          </section>

          <aside className="sidebar">
            <div className="panel">
              <div className="panel-heading">
                <h2>Participants</h2>
                <span>{users.length}</span>
              </div>

              {displayUsers.map((user, index) => (
                <div
                  className="participant"
                  key={user.id || index}
                >
                  <div className="avatar">
                    {(user.name || "U")
                      .charAt(0)
                      .toUpperCase()}
                  </div>

                  <div className="participant-info">
                    <strong>{user.name || "User"}</strong>
                    <small>{user.role || "Participant"}</small>
                  </div>

                  {isHost && user.id !== socket?.id && (
                    <div className="participant-actions">
                      {user.role !== "Moderator" && (
                        <button
                          onClick={() => assignModerator(user.id)}
                        >
                          Make Mod
                        </button>
                      )}

                      <button
                        onClick={() => removeUser(user.id)}
                      >
                        Remove
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="panel">
              <div className="panel-heading">
                <h2>Approval Requests</h2>
                <span>{requests.length}</span>
              </div>

              {requests.length === 0 ? (
                <p className="muted">
                  No pending requests.
                </p>
              ) : (
                requests.map((request, index) => (
                  <div
                    className="request"
                    key={request.id || index}
                  >
                    <p>
                      {request.name || "Participant"} requested:
                    </p>

                    <strong>{request.action}</strong>

                    {isHost && (
                      <div className="request-actions">
                        <button
                          onClick={() =>
                            approveRequest(request.id, true)
                          }
                        >
                          Approve
                        </button>

                        <button
                          onClick={() =>
                            approveRequest(request.id, false)
                          }
                        >
                          Reject
                        </button>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}

export default App;
