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

    //other players movement
    this.socket.on('playerMoved', function (playerInfo) {
        self.otherPlayers.getChildren().forEach(function (otherPlayer) {
          if (playerInfo.playerId === otherPlayer.playerId) {
            otherPlayer.setRotation(playerInfo.rotation);
            otherPlayer.setPosition(playerInfo.x, playerInfo.y);
          }
        });
    });

    //on player tagged, find and change color
    this.socket.on('playerTeamChanged', function (playerInfo) {
        self.otherPlayers.getChildren().forEach(function (otherPlayer) {
            if (playerInfo.playerId === otherPlayer.playerId) {
                if (playerInfo.team === 'chaser') {
                    otherPlayer.setTint(0xff0000);
                } else if (playerInfo.team === 'evader') {
                    otherPlayer.setTint(0x0000ff);
                }
                console.dir("turn a player's color");
            }
          });
    });

    this.customKeys = this.input.keyboard.addKeys({
        up: Phaser.Input.Keyboard.KeyCodes.up,
        down: Phaser.Input.Keyboard.KeyCodes.down,
        left: Phaser.Input.Keyboard.KeyCodes.left,
        right: Phaser.Input.Keyboard.KeyCodes.right,
        space: Phaser.Input.Keyboard.KeyCodes.space,
    });
    this.spaceKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    this.cursors = this.input.keyboard.createCursorKeys();
    this.cameras.main.setSize(800, 600);
    this.speed = 0.6;
    this.speedFactor = 1;
    this.dashCooldown = 0;
    this.test = this.physics.add.sprite(0, 0, 'player-sprite').setOrigin(0.5, 0.5).setDisplaySize(10, 10);
    this.test.x = 130;
    this.test.y = 130;
}

function update(time, delta) {
    if (this.ship) {
        var direction = new Phaser.Math.Vector2(0, 0) ;

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
        this.otherPlayers.getChildren().forEach(function (otherPlayerCollider) {
            if (checkOverlap(this.ship, otherPlayerCollider)) {
                tagOther(this, otherPlayerCollider);
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
        if (this.ship.oldPosition && (x !== this.ship.oldPosition.x || y !== this.ship.oldPosition.y || r !== this.ship.oldPosition.rotation)) {
            this.socket.emit('playerMovement', { x: this.ship.x, y: this.ship.y, rotation: this.ship.rotation });
        }
        // save old position data
        this.ship.oldPosition = {
            x: this.ship.x,
            y: this.ship.y,
            rotation: this.ship.rotation
        };
        this.cameras.main.startFollow(this.ship);        
    }
}

function addPlayer(self, playerInfo) {
    self.ship = self.physics.add.sprite(playerInfo.x, playerInfo.y, 'player-sprite').setOrigin(0.5, 0.5).setDisplaySize(40, 40);
    self.ship.x = 0;
    self.ship.y = 0;

    if (self.otherPlayers.getChildren().length === 0) { 
        self.team = 'chaser';
        self.ship.setTint(0xff0000);
        self.socket.emit('teamChange', 'chaser');

    } else {
        self.team = 'evader';
        self.ship.setTint(0x0000ff);
        self.socket.emit('teamChange', 'evader');
    }
    // if (self.ship.dashCooldown > 0) self.ship.setTint(0x6C6C6C);
    // else self.ship.setTint(0xffffff);
    self.ship.setDrag(100);
    self.ship.setAngularDrag(100);
    self.ship.setMaxVelocity(200);
}

function addOtherPlayers(self, playerInfo) {
    const otherPlayer = self.physics.add.sprite(playerInfo.x, playerInfo.y, 'enemy-sprite').setOrigin(0.5, 0.5).setDisplaySize(40, 40);
    otherPlayer.team = playerInfo.team;
    console.dir(playerInfo);
    console.dir(playerInfo.team);
    if (playerInfo.team === 'chaser') {
        otherPlayer.setTint(0xff0000);
    } else if (playerInfo.team === 'evader')
    {
        otherPlayer.setTint(0x0000ff);
    }
    // if (playerInfo.dashCooldown > 0) otherPlayer.setTint(0x6C6C6C);
    // else otherPlayer.setTint(0xffffff);
    otherPlayer.playerId = playerInfo.playerId;
    self.otherPlayers.add(otherPlayer);
}

function tagOther(self, otherPlayer) {
    console.dir("TOUCH");
    self.ship.setTint(0xea4335);
    self.socket.emit('teamChange', 'chaser');
}

function checkOverlap(spriteA, spriteB) {
    var boundsA = spriteA.getBounds();
    var boundsB = spriteB.getBounds();
    return Phaser.Geom.Intersects.RectangleToRectangle(boundsA, boundsB);
}

function dashBehavior(self, delta) {
    if(self.dashCooldown > 0) {
        self.dashCooldown -= delta;
    } else if (self.dashCooldown < 0) {
        self.dashCooldown = 0;
        self.speedFactor = 1;
        self.ship.setTint(0xFFFFFF);
    }

    if (self.speedFactor > 1) {
        self.speedFactor *= 0.95;
    } 

    if (Phaser.Input.Keyboard.JustDown(self.spaceKey) && self.dashCooldown <= 0) {
        self.speedFactor += 3;
        self.dashCooldown = 1500;
        self.ship.setTint(0x6C6C6C);
    }
}