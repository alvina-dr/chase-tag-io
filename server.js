var express = require("express");
var app = express();
var server = require("http").Server(app);
var io = require("socket.io")(server);
var players = {};
app.use(express.static(__dirname + "/public"));
app.get("/", function (req, res) {
  res.sendFile(__dirname + "/index.html");
});
io.on("connection", function (socket) {
  console.log("a user connected");
  // create a new player and add it to our players object
  players[socket.id] = {
    rotation: 0,
    x: Math.floor(Math.random() * 700) + 50,
    y: Math.floor(Math.random() * 500) + 50,
    playerId: socket.id,
    team: "",
  };

  // send the players object to the new player
  socket.emit("currentPlayers", players);

  // update all other players of the new player
  socket.broadcast.emit("newPlayer", players[socket.id]);

  //DISCONNECT
  socket.on("disconnect", function () {
    console.log("user disconnected");
    // remove this player from our players object
    delete players[socket.id];
    // emit a message to all players to remove this player
    io.emit("disconnectBis", socket.id);
  });

  //PLAYER MOVEMENT
  socket.on("playerMovement", function (movementData) {
    players[socket.id].x = movementData.x;
    players[socket.id].y = movementData.y;
    players[socket.id].rotation = movementData.rotation;
    // emit a message to all players about the player that moved
    socket.broadcast.emit("playerMoved", players[socket.id]);
  });

  //TEAM CHANGE
  socket.on("teamChange", function (data) {
    players[data.targetId].team = data.team;
    // emit a message to all players that the player changed team
    socket.broadcast.emit("playerTeamChanged", players[data.targetId]);
  });

  //PLAYER DASH
  socket.on("dash", function () {
    // emit a message to all players that the player dashed
    socket.broadcast.emit("playerDash", players[socket.id]);
  });
});

server.listen(process.env.PORT || 8081, function () {
  console.log(`Listening on ${server.address().port}`);
});
