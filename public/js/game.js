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
  this.load.image("triangle-particle", "assets/triangle-particle.png");
}

function create() {
  this.cameras.main.setBackgroundColor("#ffffff");
  var self = this;
  this.socket = io();
  this.otherPlayers = this.physics.add.group();
  this.collidingPlayers = this.physics.add.group();

  socketCalls.setupSocketCall(this);

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
  this.tagParticles = this.add.particles(0, 0, "triangle-particle", {
    speed: 300,
    lifespan: 400,
    scale: { start: 0.5, end: 0 },
    alpha: { start: 1, end: 0 },
    rotate: { random: true, start: 0, end: 180 },
    color: [0x0000ff, 0xff0000],
    colorEase: "quad.out",
    emitting: false,
  });
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
        // console.dir("PLAYER ENTER");
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
        // console.dir("PLAYER EXIT");
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
    this.trailEmitter.startFollow(this.ship, 0, 0, 0, 3, 0.5);
    this.dashParticles.startFollow(this.ship, 0, 0, 0, 3, 0.5);
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
  self.ship.setDrag(100);
  self.ship.setAngularDrag(100);
  self.ship.setMaxVelocity(200);
  self.trailEmitter = self.add.particles(0, 0, "triangle-particle", {
    speed: 100,
    lifespan: 300,
    scale: { start: 0.5, end: 0 },
    alpha: { start: 1, end: 0 },
    rotate: { random: true, start: 0, end: 180 },
    color: [0xf59d05, 0xff0000],
    colorEase: "quad.out",
    // angle: { min: -170, max: -190 },
  });
  self.dashParticles = self.add.particles(0, 0, "triangle-particle", {
    speed: 350,
    lifespan: 300,
    scale: { start: 0.6, end: 0 },
    alpha: { start: 1, end: 0 },
    rotate: { random: true, start: 0, end: 180 },
    color: [0xf59d05, 0xffffff],
    colorEase: "quad.out",
    emitting: false,
    // angle: { min: 75, max: -75 },
  });
  self.ship.depth = 100;
  self.socket.emit("playerMovement", {
    x: self.ship.x,
    y: self.ship.y,
    rotation: self.ship.rotation,
  });
}

function addOtherPlayers(self, playerInfo) {
  const otherPlayer = self.physics.add
    .sprite(playerInfo.x, playerInfo.y, "player-sprite")
    .setOrigin(0.5, 0.5)
    .setDisplaySize(40, 40);
  otherPlayer.team = playerInfo.team;
  if (playerInfo.team === "chaser") {
    otherPlayer.setTint(0xff0000);
  } else if (playerInfo.team === "evader") {
    otherPlayer.setTint(0x0000ff);
  }
  otherPlayer.playerId = playerInfo.playerId;
  otherPlayer.trailEmitter = self.add.particles(0, 0, "triangle-particle", {
    speed: 100,
    lifespan: 300,
    scale: { start: 0.5, end: 0 },
    alpha: { start: 1, end: 0 },
    rotate: { random: true, start: 0, end: 180 },
    color: [0xf59d05, 0xff0000],
    colorEase: "quad.out",
    // angle: { min: -170, max: -190 },
    x: {
      onEmit: (particle, key, t, value) => {
        return otherPlayer.x;
      },
    },
    y: {
      onEmit: (particle, key, t, value) => {
        return otherPlayer.y;
      },
    },
  });
  otherPlayer.dashParticles = self.add.particles(0, 0, "triangle-particle", {
    speed: 350,
    lifespan: 300,
    scale: { start: 0.6, end: 0 },
    alpha: { start: 1, end: 0 },
    rotate: { random: true, start: 0, end: 180 },
    color: [0xf59d05, 0xffffff],
    colorEase: "quad.out",
    emitting: false,
    // angle: { min: 75, max: -75 },
  });
  otherPlayer.depth = 100;
  self.otherPlayers.add(otherPlayer);
}

function tagTarget(self, target) {
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
  self.tagParticles.emitParticleAt(target.x, target.y, 30);
  self.cameras.main.shake(150, 0.015);
  becomeChaser(self, target);
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
    self.dashTween = self.tweens.add({
      targets: self.ship,
      // scale: 0.04,
      duration: 100,
      rotation: 36,
      yoyo: true,
      ease: Phaser.Math.Easing.Sine.InOut,
    });
    self.dashParticles.emitParticleAt(self.ship.x, self.ship.y, 20);
    self.cameras.main.shake(100, 0.01);
    self.socket.emit("dash");
  }

  if (Phaser.Input.Keyboard.JustDown(self.c)) {
    console.dir("TEAM : " + self.team);
  }
}

function becomeChaser(self, target) {
  target.tagTween = self.tweens.add({
    targets: target,
    scale: 0.15,
    duration: 100,
    yoyo: true,
    ease: Phaser.Math.Easing.Sine.InOut,
  });
  self.tagParticles.emitParticleAt(target.x, target.y, 20);
  target.setTint(0xff0000);
}
