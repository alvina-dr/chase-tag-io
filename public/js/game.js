// const { normalize } = require("path");

var config = {
    type: Phaser.AUTO,
    parent: 'phaser-example',
    width: 800,
    height: 600,
    physics: {
    default: 'arcade',
    arcade: {
        debug: false,
        gravity: { y: 0 }
    }
    },
    scene: {
    preload: preload,
    create: create,
    update: update
    } 
};

var game = new Phaser.Game(config);

function preload() { //load assets
    this.load.image('player-sprite', 'assets/player-sprite.png');
    this.load.image('enemy-sprite', 'assets/enemy-sprite.png');
}

function create() {
    var self = this;
    this.socket = io();
    this.otherPlayers = this.physics.add.group();
    this.socket.on('currentPlayers', function (players) { //on start game, gets all players
        Object.keys(players).forEach(function (id) {
        if (players[id].playerId === self.socket.id) { //if player is self
            addPlayer(self, players[id]);
        } else { //if player is other
            addOtherPlayers(self, players[id]);
        }
        });
    });

    this.socket.on('newPlayer', function (playerInfo) { //on other new player join
        addOtherPlayers(self, playerInfo);
    });

    this.socket.on('disconnectBis', function (playerId) { //on quit game
        self.otherPlayers.getChildren().forEach(function (otherPlayer) {
            if (playerId === otherPlayer.playerId) {
                otherPlayer.destroy();
            }
        });
    });

    this.socket.on('playerMoved', function (playerInfo) {
        self.otherPlayers.getChildren().forEach(function (otherPlayer) {
          if (playerInfo.playerId === otherPlayer.playerId) {
            otherPlayer.setRotation(playerInfo.rotation);
            otherPlayer.setPosition(playerInfo.x, playerInfo.y);
          }
        });
      });

    this.cursors = this.input.keyboard.createCursorKeys();
}

function update() {
    if (this.ship) {
        var direction = new Phaser.Math.Vector2(0, 0) ;

        if (this.cursors.left.isDown) {
            direction.x -= 10;
        //   this.ship.setAngularVelocity(-150);
        }
        if (this.cursors.right.isDown) {
            direction.x += 10;
        //   this.ship.setAngularVelocity(150);
        } 
        if (this.cursors.up.isDown) {
            direction.y -= 10;
        }
        if (this.cursors.down.isDown) {
            direction.y += 10;
        }

        direction.normalize();
        this.ship.x += direction.x;
        this.ship.y += direction.y;
        // this.physics.world.wrap(this.ship, 5);

        // emit player movement for other players to catch
        var x = this.ship.x;
        var y = this.ship.y;
        var r = this.ship.rotation;
        if (this.ship.oldPosition && (x !== this.ship.oldPosition.x || y !== this.ship.oldPosition.y || r !== this.ship.oldPosition.rotation)) {
        this.socket.emit('playerMovement', { x: this.ship.x, y: this.ship.y, rotation: this.ship.rotation });
        }
        // save old position data
        this.ship.oldPosition = {
            x: this.ship.x,
            y: this.ship.y,
            rotation: this.ship.rotation
        };
    }
}

function addPlayer(self, playerInfo) {
    self.ship = self.physics.add.image(playerInfo.x, playerInfo.y, 'player-sprite').setOrigin(0.5, 0.5).setDisplaySize(40, 40);
    if (playerInfo.team === 'blue') {
        self.ship.setTint(0x0000ff);
    } else {
        self.ship.setTint(0xff0000);
    }
    self.ship.setDrag(100);
    self.ship.setAngularDrag(100);
    self.ship.setMaxVelocity(200);
}

function addOtherPlayers(self, playerInfo) {
    const otherPlayer = self.add.sprite(playerInfo.x, playerInfo.y, 'enemy-sprite').setOrigin(0.5, 0.5).setDisplaySize(40, 40);
    if (playerInfo.team === 'blue') {
        otherPlayer.setTint(0x0000ff);
    } else {
        otherPlayer.setTint(0xff0000);
    }
    otherPlayer.playerId = playerInfo.playerId;
    self.otherPlayers.add(otherPlayer);
}