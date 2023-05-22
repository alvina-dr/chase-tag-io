var config = {
  type: Phaser.AUTO,
  parent: "phaser-example",
  width: 800,
  height: 600,
  physics: {
    default: "arcade",
    arcade: {
      debug: false,
      gravity: { y: 0 },
    },
  },
  scene: {
    preload: preload,
    create: create,
    update: update,
  },
};

var game = new Phaser.Game(config);

function preload() {
  //load assets
  this.load.image("player-sprite", "assets/player-sprite.png");
  this.load.image("enemy-sprite", "assets/enemy-sprite.png");
  this.load.image("grid-sprite", "assets/grid.png");
}

function create() {
  this.cameras.main.setBackgroundColor("#ffffff");
  var self = this;
  this.socket = io();
  this.otherPlayers = this.physics.add.group();
  this.collidingPlayers = this.physics.add.group();
  this.socket.on("currentPlayers", function (players) {
    //on start game, gets all players
    Object.keys(players).forEach(function (id) {
      if (players[id].playerId === self.socket.id) {
        //if player is self
        addPlayer(self, players[id]);
      } else {
        //if player is other
        addOtherPlayers(self, players[id]);
      }
    });
  });

  this.socket.on("newPlayer", function (playerInfo) {
    //on other new player join
    addOtherPlayers(self, playerInfo);
  });

  this.socket.on("disconnectBis", function (playerId) {
    //on quit game
    self.otherPlayers.getChildren().forEach(function (otherPlayer) {
      if (playerId === otherPlayer.playerId) {
        otherPlayer.destroy();
      }
    });
  });

  //other players movement
  this.socket.on("playerMoved", function (playerInfo) {
    self.otherPlayers.getChildren().forEach(function (otherPlayer) {
      if (playerInfo.playerId === otherPlayer.playerId) {
        otherPlayer.setRotation(playerInfo.rotation);
        otherPlayer.setPosition(playerInfo.x, playerInfo.y);
      }
    });
  });

  //on player tagged, find and change color
  this.socket.on("playerTeamChanged", function (playerInfo) {
    if (playerInfo.playerId === self.socket.id) {
      self.team = playerInfo.team;
      if (playerInfo.team === "chaser") {
        self.ship.setTint(0xff0000);
      } else if (playerInfo.team === "evader") {
        self.ship.setTint(0x0000ff);
      }
    } else {
      self.otherPlayers.getChildren().forEach(function (otherPlayer) {
        console.dir("on team change : " + otherPlayer.team);
        if (playerInfo.playerId === otherPlayer.playerId) {
          otherPlayer.team = playerInfo.team;
          if (playerInfo.team === "chaser") {
            otherPlayer.setTint(0xff0000);
          } else if (playerInfo.team === "evader") {
            otherPlayer.setTint(0x0000ff);
          }
        }
      });
    }
  });

  this.customKeys = this.input.keyboard.addKeys({
    up: Phaser.Input.Keyboard.KeyCodes.up,
    down: Phaser.Input.Keyboard.KeyCodes.down,
    left: Phaser.Input.Keyboard.KeyCodes.left,
    right: Phaser.Input.Keyboard.KeyCodes.right,
    space: Phaser.Input.Keyboard.KeyCodes.space,
  });
  this.spaceKey = this.input.keyboard.addKey(
    Phaser.Input.Keyboard.KeyCodes.SPACE
  );
  this.c = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.C);
  this.cursors = this.input.keyboard.createCursorKeys();
  this.cameras.main.setSize(800, 600);
  this.speed = 0.6;
  this.speedFactor = 1;
  this.dashCooldown = 0;
  this.test = this.physics.add
    .sprite(0, 0, "grid-sprite")
    .setOrigin(0.5, 0.5)
    .setDisplaySize(2500, 2000);
}

function update(time, delta) {
  if (this.ship) {
    var direction = new Phaser.Math.Vector2(0, 0);

    if (this.cursors.left.isDown) {
      direction.x -= 1;
    }
    if (this.cursors.right.isDown) {
      direction.x += 1;
    }
    if (this.cursors.up.isDown) {
      direction.y -= 1;
    }
    if (this.cursors.down.isDown) {
      direction.y += 1;
    }

    //DETECT COLLISION ENTER
    this.otherPlayers.getChildren().forEach(function (otherPlayerCollider) {
      if (
        this.collidingPlayers.getMatching(
          "playerId",
          otherPlayerCollider.playerId
        ).length === 0 &&
        checkOverlap(this.ship, otherPlayerCollider)
      ) {
        console.dir("PLAYER ENTER");
        this.collidingPlayers.add(otherPlayerCollider);
        if (this.team === "chaser" && otherPlayerCollider.team === "evader") {
          tagTarget(this, otherPlayerCollider);
        }
      } else if (
        this.collidingPlayers.getMatching(
          "playerId",
          otherPlayerCollider.playerId
        ).length > 0 &&
        !checkOverlap(this.ship, otherPlayerCollider)
      ) {
        console.dir("PLAYER EXIT");
        this.collidingPlayers.remove(otherPlayerCollider);
      }
    }, this);

    //DASH SECTION
    dashBehavior(this, delta);

    direction.normalize();
    this.ship.x += direction.x * this.speedFactor * this.speed * delta;
    this.ship.y += direction.y * this.speedFactor * this.speed * delta;

    // emit player movement for other players to catch
    var x = this.ship.x;
    var y = this.ship.y;
    var r = this.ship.rotation;
    if (
      this.ship.oldPosition &&
      (x !== this.ship.oldPosition.x ||
        y !== this.ship.oldPosition.y ||
        r !== this.ship.oldPosition.rotation)
    ) {
      this.socket.emit("playerMovement", {
        x: this.ship.x,
        y: this.ship.y,
        rotation: this.ship.rotation,
      });
    }
    // save old position data
    this.ship.oldPosition = {
      x: this.ship.x,
      y: this.ship.y,
      rotation: this.ship.rotation,
    };
    this.cameras.main.startFollow(this.ship);
  }
}

function addPlayer(self, playerInfo) {
  self.ship = self.physics.add
    .sprite(playerInfo.x, playerInfo.y, "player-sprite")
    .setOrigin(0.5, 0.5)
    .setDisplaySize(40, 40);
  self.ship.x = 0;
  self.ship.y = 0;
  console.dir("id to declare is : " + self.socket.id);
  if (self.otherPlayers.getMatching("team", "chaser").length === 0) {
    self.team = "chaser";
    self.ship.setTint(0xff0000);
    self.socket.emit("teamChange", {
      targetId: self.socket.id,
      team: "chaser",
    });
  } else {
    self.team = "evader";
    self.ship.setTint(0x0000ff);
    self.socket.emit("teamChange", {
      targetId: self.socket.id,
      team: "evader",
    });
  }
  // self.pulseTween = self.tweens.add({
  //   targets: self.ship,
  //   // tint: 0xff00ff,
  //   scale: 0.05,
  //   yoyo: true,
  //   duration: 300,
  //   loop: -1,
  //   ease: Phaser.Math.Easing.Sine.InOut,
  // });
  self.ship.setDrag(100);
  self.ship.setAngularDrag(100);
  self.ship.setMaxVelocity(200);
}

function addOtherPlayers(self, playerInfo) {
  const otherPlayer = self.physics.add
    .sprite(playerInfo.x, playerInfo.y, "player-sprite")
    .setOrigin(0.5, 0.5)
    .setDisplaySize(40, 40);
  otherPlayer.team = playerInfo.team;
  console.dir(playerInfo.team);
  if (playerInfo.team === "chaser") {
    otherPlayer.setTint(0xff0000);
  } else if (playerInfo.team === "evader") {
    otherPlayer.setTint(0x0000ff);
  }
  otherPlayer.playerId = playerInfo.playerId;
  self.otherPlayers.add(otherPlayer);
}

function tagTarget(self, target) {
  console.dir("GIVE TAG");
  self.ship.setTint(0x0000ff);
  target.setTint(0xff0000);
  self.team = "evader";
  target.team = "chaser";
  self.socket.emit("teamChange", {
    targetId: self.socket.id,
    team: "evader",
  });
  self.socket.emit("teamChange", {
    targetId: target.playerId,
    team: "chaser",
  });
}

function checkOverlap(spriteA, spriteB) {
  var boundsA = spriteA.getBounds();
  var boundsB = spriteB.getBounds();
  return Phaser.Geom.Intersects.RectangleToRectangle(boundsA, boundsB);
}

function dashBehavior(self, delta) {
  if (self.dashCooldown > 0) {
    self.dashCooldown -= delta;
  } else if (self.dashCooldown < 0) {
    self.dashCooldown = 0;
    self.speedFactor = 1;
  }

  if (self.speedFactor > 1) {
    self.speedFactor *= 0.95;
  }

  if (Phaser.Input.Keyboard.JustDown(self.spaceKey) && self.dashCooldown <= 0) {
    self.speedFactor += 3;
    self.dashCooldown = 1500;
    self.pulseTween = self.tweens.add({
      targets: self.ship,
      // tint: 0xff00ff,
      scale: 0.04,
      duration: 100,
      rotation: 36,
      yoyo: true,
      ease: Phaser.Math.Easing.Sine.InOut,
    });
    //     self.ship.setTint(0x6c6c6c);
  }

  if (Phaser.Input.Keyboard.JustDown(self.c)) {
    console.dir("TEAM : " + self.team);
  }
}
