var socketCalls = {
  setupSocketCall: function (game) {
    console.dir("setupSocketCall");
    game.socket.on("currentPlayers", function (players) {
      //on start game, gets all players
      Object.keys(players).forEach(function (id) {
        if (players[id].playerId === game.socket.id) {
          //if player is self
          addPlayer(game, players[id]);
        } else {
          //if player is other
          addOtherPlayers(game, players[id]);
        }
      });
    });

    game.socket.on("newPlayer", function (playerInfo) {
      //on other new player join
      addOtherPlayers(game, playerInfo);
    });

    game.socket.on("disconnectBis", function (playerId) {
      //on quit game
      game.otherPlayers.getChildren().forEach(function (otherPlayer) {
        if (playerId === otherPlayer.playerId) {
          otherPlayer.trailEmitter.destroy();
          otherPlayer.destroy();
        }
      });
    });

    //other players movement
    game.socket.on("playerMoved", function (playerInfo) {
      game.otherPlayers.getChildren().forEach(function (otherPlayer) {
        if (playerInfo.playerId === otherPlayer.playerId) {
          otherPlayer.setRotation(playerInfo.rotation);
          otherPlayer.setPosition(playerInfo.x, playerInfo.y);
        }
      });
    });

    //on player tagged, find and change color
    game.socket.on("playerTeamChanged", function (playerInfo) {
      if (playerInfo.playerId === game.socket.id) {
        game.team = playerInfo.team;
        if (playerInfo.team === "chaser") {
          becomeChaser(game, game.ship);
          game.cameras.main.shake(150, 0.015);
        } else if (playerInfo.team === "evader") {
          game.ship.setTint(0x0000ff);
        }
      } else {
        game.otherPlayers.getChildren().forEach(function (otherPlayer) {
          if (playerInfo.playerId === otherPlayer.playerId) {
            otherPlayer.team = playerInfo.team;
            if (playerInfo.team === "chaser") {
              becomeChaser(game, otherPlayer);
            } else if (playerInfo.team === "evader") {
              otherPlayer.setTint(0x0000ff);
            }
          }
        });
      }
    });

    game.socket.on("playerDash", function (playerInfo) {
      game.otherPlayers.getChildren().forEach(function (otherPlayer) {
        if (playerInfo.playerId === otherPlayer.playerId) {
          otherPlayer.dashParticles.emitParticleAt(
            otherPlayer.x,
            otherPlayer.y,
            20
          );
          otherPlayer.dashTween = game.tweens.add({
            targets: self.ship,
            duration: 100,
            rotation: 36,
            yoyo: true,
            ease: Phaser.Math.Easing.Sine.InOut,
          });
        }
      });
    });
  },
};
