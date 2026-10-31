import React, { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import "./style.css";

const SERVER_URL = "https://youtube-watch-party-system-2.onrender.com";

function App() {
  const socketRef = useRef(null);
  const playerRef = useRef(null);
  const roomRef = useRef("");

  const [name, setName] = useState("");
  const [roomCode, setRoomCode] = useState("");
  const [activeRoom, setActiveRoom] = useState(false);
  const [role, setRole] = useState("Participant");
  const [users, setUsers] = useState([]);
  const [requests, setRequests] = useState([]);
  const [videoId, setVideoId] = useState("jfKfPfyJRdk");
  const [videoInput, setVideoInput] = useState("");
  const [message, setMessage] = useState("");
  const [playerReady, setPlayerReady] = useState(false);
  const [playing, setPlaying] = useState(false);

  const isHost = role === "Host";
  const canControl = isHost || role === "Moderator";

  useEffect(() => {
    const socket = io(SERVER_URL);
    socketRef.current = socket;

    socket.on("connect", () => {
      setMessage("Connected to server!");
    });

    socket.on("connect_error", () => {
      setMessage("Server connection failed!");
    });

    socket.on("room_created", (data) => enterRoom(data));
    socket.on("room_joined", (data) => enterRoom(data));

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
      if (data.videoId) setVideoId(data.videoId);

      const player = playerRef.current;

      if (player) {
        if (data.action === "play") player.playVideo();
        if (data.action === "pause") player.pauseVideo();

        if (data.action === "seek") {
          player.seekTo(data.currentTime || 0, true);
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

    socket.on("request_sent", () => {
      setMessage("Request delivered to the Host.");
    });

    socket.on("remove_result", (data) => {
      setMessage(data.message || "Removal response received.");
    });

    socket.on("participant_removed", () => {
      setActiveRoom(false);
      setUsers([]);
      setRequests([]);
      roomRef.current = "";
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

    roomRef.current = code;
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

    if (!socketRef.current?.connected) {
      setMessage("Server is not connected. Please wait.");
      return;
    }

    socketRef.current.emit("create_room", {
      name: name.trim()
    });
  }

  function joinRoom() {
    if (!name.trim() || !roomCode.trim()) {
      setMessage("Enter your name and room code.");
      return;
    }

    if (!socketRef.current?.connected) {
      setMessage("Server is not connected. Please wait.");
      return;
    }

    socketRef.current.emit("join_room", {
      name: name.trim(),
      roomCode: roomCode.trim().toUpperCase()
    });
  }

  function playbackAction(action, extra = {}) {
    if (!activeRoom) return;

    const socket = socketRef.current;

    if (!canControl) {
      socket.emit("request_action", {
        roomCode: roomRef.current,
        action,
        ...extra
      });

      setMessage("Request sent to the Host.");
      return;
    }

    socket.emit("playback_action", {
      roomCode: roomRef.current,
      action,
      ...extra
    });
  }

  function extractYouTubeId(input) {
    const raw = input.trim();
    let id = raw;

    try {
      if (/^https?:\/\//i.test(raw)) {
        const url = new URL(raw);
        const host = url.hostname.replace(/^www\./, "");

        if (host === "youtu.be") {
          id = url.pathname.split("/").filter(Boolean)[0];
        } else if (
          ["youtube.com", "m.youtube.com", "music.youtube.com"].includes(host)
        ) {
          if (url.pathname === "/watch") {
            id = url.searchParams.get("v");
          } else if (
            ["/embed/", "/shorts/", "/live/"].some((path) =>
              url.pathname.startsWith(path)
            )
          ) {
            id = url.pathname.split("/").filter(Boolean)[1];
          }
        }
      }
    } catch {
      return null;
    }

    return id && /^[a-zA-Z0-9_-]{11}$/.test(id) ? id : null;
  }
    function changeVideo() {
    if (!canControl) {
      setMessage("Only Host or Moderator can change the video.");
      return;
    }

    const id = extractYouTubeId(videoInput);

    if (!id) {
      setMessage("Invalid YouTube URL or video ID.");
      return;
    }

    playbackAction("change_video", { videoId: id });
    setVideoInput("");
    setMessage("Video change request sent.");
  }

  function assignModerator(userId) {
    socketRef.current.emit("assign_role", {
      roomCode: roomRef.current,
      userId,
      role: "Moderator"
    });
  }

  function removeUser(userId) {
    if (!isHost || !userId) return;

    socketRef.current.emit("remove_participant", {
      roomCode: roomRef.current,
      userId
    });

    setMessage("Removal request sent.");
  }

  function approveRequest(requestId, approved) {
    socketRef.current.emit("approve_request", {
      roomCode: roomRef.current,
      requestId,
      approved
    });
  }

  function leaveRoom() {
    socketRef.current.emit("leave_room", {
      roomCode: roomRef.current
    });

    setActiveRoom(false);
    setUsers([]);
    setRequests([]);
    setRole("Participant");
    roomRef.current = "";
    setPlayerReady(false);
    playerRef.current = null;
  }

  function copyInvite() {
    const link = `${window.location.origin}?room=${roomRef.current}`;

    navigator.clipboard.writeText(link)
      .then(() => setMessage("Invite link copied!"))
      .catch(() => setMessage("Could not copy invite link."));
  }

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const invitedRoom = params.get("room");

    if (invitedRoom) {
      setRoomCode(invitedRoom.toUpperCase());
    }
  }, []);

  useEffect(() => {
    if (!activeRoom) return;

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
          onReady: () => setPlayerReady(true),
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

    if (window.YT && window.YT.Player) {
      initializePlayer();
    } else {
      if (!document.getElementById("youtube-api")) {
        const script = document.createElement("script");
        script.id = "youtube-api";
        script.src = "https://www.youtube.com/iframe_api";
        document.body.appendChild(script);
      }

      window.onYouTubeIframeAPIReady = initializePlayer;
    }

    return () => {
      window.onYouTubeIframeAPIReady = null;
    };
  }, [activeRoom]);

  useEffect(() => {
    if (!playerReady || !playerRef.current) return;

    playerRef.current.loadVideoById(videoId);
  }, [videoId, playerReady]);

  const displayUsers = users.length
    ? users
    : [{ id: socketRef.current?.id, name, role }];

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
            <p className="muted">Enter your details to get started.</p>

            <label>Your Name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter your name"
            />

            <button className="primary-btn" onClick={createRoom}>
              + Create New Room
            </button>

            <div className="separator">
              <span>OR JOIN EXISTING ROOM</span>
            </div>

            <label>Room Code</label>
            <input
              value={roomCode}
              onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
              placeholder="Enter room code"
            />

            <button className="secondary-btn" onClick={joinRoom}>
              Join Watch Party →
            </button>

            {message && <p className="message">{message}</p>}
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
          <button onClick={copyInvite}>Copy Invite</button>
        </div>

        <button className="leave-btn" onClick={leaveRoom}>
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

        {message && <div className="message">{message}</div>}

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

              <button onClick={changeVideo} disabled={!canControl}>
                Change Video
              </button>
            </div>

            <div className="controls">
              <button onClick={() => playbackAction("play")}>
                ▶ Play
              </button>

              <button onClick={() => playbackAction("pause")}>
                ⏸ Pause
              </button>

              <button
                onClick={() =>
                  playbackAction("seek", {
                    currentTime: playerRef.current?.getCurrentTime() || 0
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
                <span>{displayUsers.length}</span>
              </div>

              {displayUsers.map((user, index) => (
                <div className="participant" key={user.id || index}>
                  <div className="avatar">
                    {(user.name || "U").charAt(0).toUpperCase()}
                  </div>

                  <div className="participant-info">
                    <strong>{user.name || "User"}</strong>
                    <small>{user.role || "Participant"}</small>
                  </div>

                  {isHost && user.id !== socketRef.current?.id && (
                    <div className="participant-actions">
                      {user.role !== "Moderator" && (
                        <button onClick={() => assignModerator(user.id)}>
                          Make Mod
                        </button>
                      )}

                      <button onClick={() => removeUser(user.id)}>
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
                <p className="muted">No pending requests.</p>
              ) : (
                requests.map((request, index) => (
                  <div className="request" key={request.id || index}>
                    <p>
                      {request.name || "Participant"} requested:
                    </p>

                    <strong>{request.action}</strong>

                    {isHost && (
                      <div className="request-actions">
                        <button
                          onClick={() => approveRequest(request.id, true)}
                        >
                          Approve
                        </button>

                        <button
                          onClick={() => approveRequest(request.id, false)}
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
