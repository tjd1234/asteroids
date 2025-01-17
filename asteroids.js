// asteroids.js

//
// To do:
// - add thrusters animation when W pressed
// - make explosion animation more interesting
// - add jump to hyperspace (random location, random direction)
// - improve rock animation, e.g. make them multiple rotating squares
// - filter out dead objects in-place instead of using filter()
// - ship should continue to accelerate when the W key is held down
// - since there are a fixed number of bullets, a fixed-sized list can be used,
//   with a pre-defined set of bullets
//

//
// helper functions
//
function dotAt(x, y, size, color) {
  push();
  fill(color);
  noStroke();
  ellipse(x, y, size, size);
  pop();
}

function redDotAt(x, y) {
  dotAt(x, y, 5, "red");
}

function greenDotAt(x, y) {
  dotAt(x, y, 5, "green");
}

//
// constants
//
const BG_COLOR = 0;
const OUTLINE_COLOR = 255;

const SHIP_DECEL = 0.003;
const SHIP_ANGLE_RATE = 4;
const SHIP_MAX_SPEED = 5;

const BULLET_MAX = 5;
const BULLET_LIFE_MS = 1800;
const BULLET_SPEED = 3;
const BULLET_SIZE = 2;

const ROCK_MIN_ROTATION = 0.5;

const LEVEL_DELAY_MS = 2000;

const ROCK_EXPLOSION_DELAY_MS = 1000;
const ROCK_EXPLOSION_MIN_RATE = 0.5;
const ROCK_EXPLOSION_MAX_RATE = 0.75;
const ROCK_PARTICLE_MIN_SIZE = 1;
const ROCK_PARTICLE_MAX_SIZE = 1.5;

const SHIP_EXPLOSION_DELAY_MS = 10 * 1000;
const SHIP_PARTICLE_MIN_SIZE = 2;
const SHIP_PARTICLE_MAX_SIZE = 4;

//
// game state
//
let gameState = {
  level: 1,
  lives: 3,
  score: 0,
  status: "ready", // "ready", "playing", "game over", "transitioning"
};

//
// the player's ship
//
const ship = {
  x: 200, // position of the ship is (x, y)
  y: 200,
  dx: 0, // velocity of the ship is (dx, dy)
  dy: 0,
  angle: 0, // angle of the ship in degrees
  angleRate: 0, // rate of change of the ship angle
  noseX: 0, // position of the ship's nose (where the bullet comes out)
  noseY: 0,
  width: 14,
  height: 20,
  fillColor: BG_COLOR,
  outlineColor: OUTLINE_COLOR,
  dead: false,
  showNose: true,
  showCenter: true,
  invincible: false,
};

//
// bullets
//
let bullets = [];

function makeBullet(x, y, dx, dy) {
  const bullet = {
    x,
    y,
    dx,
    dy, // short-hand for x: x, y: y, dx: dx, dy: dy
    fillColor: BG_COLOR,
    outlineColor: OUTLINE_COLOR,
    dead: false,
  };
  return bullet;
}

//
// asteroids
//
let rocks = [];

const rock_size = {
  small: 10,
  medium: 25,
  large: 40,
};

const rock_score = {
  small: 100,
  medium: 200,
  large: 300,
};

function makeRock(x, y, dx, dy, size) {
  const rock = {
    x, // short-hand for x: x, y: y, dx: dx, dy: dy
    y,
    dx,
    dy,
    angle: random(0, 360),
    angleRate: ROCK_MIN_ROTATION + random(-2, 2),
    size, // short-hand for size: size
    dead: false,
    showOutline: true,
    showHitCircle: false,
  };
  return rock;
}

function hitRock(rock, x, y) {
  const d = dist(rock.x, rock.y, x, y);
  return d <= rock.size / 2;
}

function randRockPoint(span) {
  if (random(0, 1) < 0.5) {
    return random(0, span * 0.25);
  } else {
    return random(span * 0.75, span);
  }
}

function randRockX() {
  return randRockPoint(width);
}

function randRockY() {
  return randRockPoint(height);
}

function addRandRock(x, y, rockSize) {
  const angle = random(0, 360) * (Math.PI / 180);
  const speed = random(0.5, 1.5);
  angleMode(RADIANS); // ensure P5's sin and cos use radians
  rocks.push(makeRock(x, y, speed * cos(angle), speed * sin(angle), rockSize));
}

function addInitialLargeRocks(numRocks) {
  rocks = [];
  for (let i = 0; i < numRocks; i++) {
    addRandRock(randRockX(), randRockY(), rock_size.large);
  } // for
}

//
// rock explosion animation
//
let rockExplosions = [];

function makePoint(a, b) {
  return { x: a, y: b };
}

function midpoint(a, b) {
  return makePoint((a.x + b.x) / 2, (a.y + b.y) / 2);
}

function randSign() {
  return random(0, 1) < 0.5 ? 1 : -1;
}

function makeSegment(A, B) {
  return {
    start: A,
    end: B,
    mid: midpoint(A, B),
    angleRate:
      random(ROCK_EXPLOSION_MIN_RATE, ROCK_EXPLOSION_MAX_RATE) * randSign(),
    angle: 0,
  };
}

function makeParticle(x, y, minSize, maxSize) {
  return {
    x,
    y,
    dx: random(0.25, 1) * randSign(),
    dy: random(0.25, 1) * randSign(),
    size: random(minSize, maxSize),
  };
}

function makeRockExplosion(rock) {
  const { x, y, size } = rock;
  const s = size / 2;
  const A = makePoint(x + s, y + s);
  const B = makePoint(x + s, y - s);
  const C = makePoint(x - s, y - s);
  const D = makePoint(x - s, y + s);
  const AB = makeSegment(A, B);
  const BC = makeSegment(B, C);
  const CD = makeSegment(C, D);
  const DA = makeSegment(D, A);

  const explosion = {
    segments: [AB, BC, CD, DA],
    brightness: 255,
    particles: [
      makeParticle(x, y, ROCK_PARTICLE_MIN_SIZE, ROCK_PARTICLE_MAX_SIZE),
      makeParticle(x, y, ROCK_PARTICLE_MIN_SIZE, ROCK_PARTICLE_MAX_SIZE),
      makeParticle(x, y, ROCK_PARTICLE_MIN_SIZE, ROCK_PARTICLE_MAX_SIZE),
      makeParticle(x, y, ROCK_PARTICLE_MIN_SIZE, ROCK_PARTICLE_MAX_SIZE),
    ],
    dead: false,
  };
  return explosion;
}

function drawRockExplosions() {
  push();
  for (const e of rockExplosions) {
    stroke(e.brightness);
    for (const seg of e.segments) {
      // draw segments
      push();
      translate(seg.mid.x, seg.mid.y);
      rotate(seg.angle);
      line(
        seg.start.x - seg.mid.x,
        seg.start.y - seg.mid.y,
        seg.end.x - seg.mid.x,
        seg.end.y - seg.mid.y
      );
      pop();
    }
    // draw particles
    for (const p of e.particles) {
      fill(e.brightness);
      rect(p.x, p.y, p.size, p.size);
    }
  }
  pop();
}

function removeRockExplosionAfterDelay(e) {
  setTimeout(() => {
    e.dead = true;
  }, ROCK_EXPLOSION_DELAY_MS);
}

function updateRockExplosions() {
  for (const e of rockExplosions) {
    e.brightness -= 5;
    e.brightness = constrain(e.brightness, 25, 255);
    for (const seg of e.segments) {
      seg.angle += seg.angleRate;
    }
    for (const p of e.particles) {
      p.x += p.dx;
      p.y += p.dy;
    }
  }
  // remove dead explosions
  rockExplosions = rockExplosions.filter((e) => !e.dead);
}

//
// ship explosion animation
//
let shipExplosions = [];

function makeShipExplosion(ship) {
  const particles = Array(20)
    .fill()
    .map(() =>
      makeParticle(
        ship.x,
        ship.y,
        SHIP_PARTICLE_MIN_SIZE,
        SHIP_PARTICLE_MAX_SIZE
      )
    );
  return particles;
}

function removeShipExplosionAfterDelay(e) {
  setTimeout(() => {
    e.dead = true;
  }, SHIP_EXPLOSION_DELAY_MS);
}

function drawShipExplosions() {
  push();
  for (const e of shipExplosions) {
    for (const p of e) {
      fill(255, 0, 0);
      rect(p.x, p.y, p.size, p.size);
    }
  }
  pop();
}

function updateShipExplosions() {
  for (const e of shipExplosions) {
    for (const p of e) {
      p.x += p.dx;
      p.y += p.dy;
    }
  }
  // remove dead explosions
  shipExplosions = shipExplosions.filter((e) => !e.dead);
}

//
// score
//
const score = {
  x: 10,
  y: 20,
  fontSize: 16,
  color: 255,
};

//
// initialize the game
//
// initialize the game
//
function initializeGame() {
  gameState.status = "playing";
  gameState.score = 0;
  gameState.lives = 3;
  gameState.level = 1;
  bullets = [];
  shipExplosions = [];
  rockExplosions = [];
  rocks = [];
  addInitialLargeRocks(3);
  ship.x = 200;
  ship.y = 200;
  ship.dx = 0;
  ship.dy = 0;
  ship.angle = 0;
  ship.angleRate = 0;
}

//
// main setup and draw functions
//
function setup() {
  createCanvas(400, 400);
  // noCursor(); // turn off the mouse pointer so we can see the ship

  initializeGame();
}

function draw() {
  background(0);

  if (gameState.status === "playing") {
    updateShip();
    drawShip();

    updateBullets();
    drawBullets();

    updateRocks();
    drawRocks();

    updateRockExplosions();
    drawRockExplosions();

    updateShipExplosions();
    drawShipExplosions();

    drawScore();
  } else if (gameState.status === "game over") {
    updateBullets();
    drawBullets();

    updateRocks();
    drawRocks();

    updateRockExplosions();
    drawRockExplosions();

    updateShipExplosions();
    drawShipExplosions();

    drawGameOver();
  } else if (gameState.status === "transitioning") {
    updateShip();
    drawShip();

    updateBullets();
    drawBullets();

    updateRockExplosions();
    drawRockExplosions();

    updateShipExplosions();
    drawShipExplosions();
  } else if (gameState.status === "ready") {
    drawReady();
  }
} // draw

function drawShip() {
  push();

  stroke(ship.outlineColor);
  if (ship.invincible) {
    stroke(255, 255, 0);
  }
  fill(ship.fillColor);

  // move origin
  translate(ship.x, ship.y);

  // rotate entire screen around the origin
  angleMode(DEGREES); // rotate using degrees
  rotate(ship.angle);

  // draw the ship
  // draw the ship: triangle(nose, left wing, right wing)
  // width = 14, height = 20
  triangle(
    0,
    -ship.height / 2,
    -ship.width / 2,
    ship.height / 2,
    ship.width / 2,
    ship.height / 2
  );

  pop();

  if (ship.showNose) {
    redDotAt(ship.noseX, ship.noseY);
  }
  if (ship.showCenter) {
    greenDotAt(ship.x, ship.y);
  }
}

function updateShip() {
  // update ship position based on velocity
  ship.x += ship.dx;
  ship.y += ship.dy;

  // make wrap-around screen if it goes off edge
  if (ship.x < 0) {
    ship.x = width - 1;
  } else if (ship.x >= width) {
    ship.x = 0;
  }

  if (ship.y < 0) {
    ship.y = height - 1;
  } else if (ship.y >= height) {
    ship.y = 0;
  }

  // decrease velocity ship
  if (ship.dx > 0) {
    ship.dx = constrain(ship.dx - SHIP_DECEL, 0, ship.dx);
  } else if (ship.dx < 0) {
    ship.dx = constrain(ship.dx + SHIP_DECEL, ship.dx, 0);
  }

  if (ship.dy > 0) {
    ship.dy = constrain(ship.dy - SHIP_DECEL, 0, ship.dy);
  } else if (ship.dy < 0) {
    ship.dy = constrain(ship.dy + SHIP_DECEL, ship.dy, 0);
  }

  // update angle of ship
  ship.angle += ship.angleRate;

  //
  // At this point x, y, dx, dy, and dy are updated. Now update the position of
  // the nose.
  //
  const angle = (ship.angle - 90) * (Math.PI / 180);
  ship.noseX = ship.x + (ship.height / 2) * Math.cos(angle);
  ship.noseY = ship.y + (ship.height / 2) * Math.sin(angle);
}

//
// bullet functions
//
function drawBullets() {
  push();

  for (const b of bullets) {
    fill(b.outlineColor);
    stroke(b.outlineColor);
    ellipse(b.x, b.y, BULLET_SIZE, BULLET_SIZE);

    // bullets wrap-around screen
    if (b.x < 0) {
      b.x = width - 1;
    } else if (b.x >= width) {
      b.x = 0;
    }

    if (b.y < 0) {
      b.y = height - 1;
    } else if (b.y >= height) {
      b.y = 0;
    }
  }

  pop();
} // drawBullets

function updateBullets() {
  for (const bullet of bullets) {
    bullet.x += bullet.dx;
    bullet.y += bullet.dy;
  }
  // remove dead bullets
  bullets = bullets.filter((b) => !b.dead);
}

// make the sprite disappear after a delay
function removeBulletAfterDelay(b, delayMS) {
  setTimeout(() => {
    b.dead = true;
  }, delayMS);
}

//
// rock functions
//
function drawRocks() {
  push();
  // fill(BG_COLOR);
  noFill();

  rectMode(CENTER);
  for (const r of rocks) {
    stroke(OUTLINE_COLOR);
    push();
    translate(r.x, r.y);
    angleMode(DEGREES);
    rotate(r.angle);
    if (r.showOutline) {
      rect(0, 0, r.size, r.size);
    }
    if (r.showHitCircle) {
      stroke(0, 255, 0);
      ellipse(0, 0, r.size, r.size);
    }
    pop();
  } // for

  pop();
} // drawRocks

function updateRocks() {
  // to use P5's sin and cos need to use radians
  for (const r of rocks) {
    // check if the ship hit the rock
    if (
      hitRock(r, ship.x, ship.y) &&
      !ship.invincible &&
      gameState.status === "playing"
    ) {
      gameState.status = "game over";
      const e = makeShipExplosion(ship);
      shipExplosions.push(e);
      removeShipExplosionAfterDelay(e);
    } else if (
      hitRock(r, ship.noseX, ship.noseY) &&
      !ship.invincible &&
      gameState.status === "playing"
    ) {
      gameState.status = "game over";
      const e = makeShipExplosion(ship);
      shipExplosions.push(e);
      removeShipExplosionAfterDelay(e);
    }

    // check if a bullet hit the rock
    let hit = false;
    for (const b of bullets) {
      if (hitRock(r, b.x, b.y)) {
        hit = true;
        b.dead = true;

        // add explosion
        const e = makeRockExplosion(r);
        rockExplosions.push(e);
        removeRockExplosionAfterDelay(e);

        // rocks explode into other rocks
        switch (r.size) {
          case rock_size.small: // remove small rock
            gameState.score += rock_score.small;
            r.dead = true;
            break;
          case rock_size.medium: // split medium rock into two small rocks
            gameState.score += rock_score.medium;
            r.dead = true;
            addRandRock(r.x, r.y, rock_size.small);
            addRandRock(r.x, r.y, rock_size.small);
            break;
          case rock_size.large: // split large rock into two medium rocks with random direction
            gameState.score += rock_score.large;
            r.dead = true;
            addRandRock(r.x, r.y, rock_size.medium);
            addRandRock(r.x, r.y, rock_size.medium);
            break;
        } // switch
      } // if hitRock
    } // for bullets

    // if hit a rock, skip to next rock
    if (hit) continue;

    // move the rock
    r.x += r.dx;
    r.y += r.dy;
    r.angle += r.angleRate;

    // rocks wrap-around screen
    if (r.x < 0) {
      r.x = width - 1;
    } else if (r.x >= width) {
      r.x = 0;
    }

    if (r.y < 0) {
      r.y = height - 1;
    } else if (r.y >= height) {
      r.y = 0;
    }
  } // for

  // remove dead rocks
  rocks = rocks.filter((r) => !r.dead);

  // go to the next level if all rocks are dead
  if (rocks.length === 0) {
    gameState.status = "transitioning";
    setTimeout(() => {
      gameState.level++;
      addInitialLargeRocks(Math.min(5, 2 + gameState.level));
      gameState.status = "playing";
    }, LEVEL_DELAY_MS);
  }
} // updateRocks

//
// score functions
//
function drawScore() {
  push();
  textSize(score.fontSize);
  fill("green");
  text(gameState.score.toString(), score.x, score.y);
  pop();
}

function drawGameOver() {
  push();
  textSize(score.fontSize);
  fill("red");
  text(`Game Over: ${gameState.score}`, width / 2 - 75, height / 2);
  text("Press P to play again", width / 2 - 100, height / 2 + 20);
  pop();
}

function drawReady() {
  push();
  textSize(score.fontSize);
  fill("red");
  text("Ready", score.x, score.y);
  pop();
}

//
// keyboard input
//

const userActions = {
  left: ["a", "A"],
  right: ["d", "D"],
  accelerate: ["w", "W"],
  shoot: [" ", " "],
  invincible: ["i", "I"],
};

function keyPressed() {
  // key is a pre-defined P5 variable that holds the letter of the key that was
  // pressed

  if (gameState.status === "ready") {
    gameState.status = "playing";
    gameState.score = 0;
  } else if (gameState.status === "game over") {
    if (key === "p" || key === "P") {
      initializeGame();
    }
  }

  if (!["playing", "transitioning"].includes(gameState.status)) return;

  if (userActions.left.includes(key)) {
    ship.angleRate = -SHIP_ANGLE_RATE;
  } else if (userActions.right.includes(key)) {
    ship.angleRate = SHIP_ANGLE_RATE;
  } else if (userActions.accelerate.includes(key)) {
    ship.dx += sin(ship.angle);
    ship.dy += -cos(ship.angle);
  } else if (userActions.shoot.includes(key)) {
    if (bullets.length < BULLET_MAX) {
      const bdx = ship.noseX - ship.x;
      const bdy = ship.noseY - ship.y;
      const h = dist(ship.x, ship.y, ship.noseX, ship.noseY);
      const b = makeBullet(
        ship.noseX,
        ship.noseY,
        ship.dx + (bdx / h) * BULLET_SPEED,
        ship.dy + (bdy / h) * BULLET_SPEED
      );
      bullets.push(b);
      removeBulletAfterDelay(b, BULLET_LIFE_MS);
    }
  } else if (userActions.invincible.includes(key)) {
    ship.invincible = !ship.invincible;
  }

  // switch (key) {
  //   case "a":
  //   case "A": // turn left
  //     ship.angleRate = -SHIP_ANGLE_RATE;
  //     break;
  //   case "d":
  //   case "D": // turn right
  //     ship.angleRate = SHIP_ANGLE_RATE;
  //     break;
  //   case "w":
  //   case "W": // accelerate
  //     ship.dx += sin(ship.angle);
  //     ship.dy += -cos(ship.angle);

  //     // limit the max speed of the ship
  //     ship.dx = constrain(ship.dx, -SHIP_MAX_SPEED, SHIP_MAX_SPEED);
  //     ship.dy = constrain(ship.dy, -SHIP_MAX_SPEED, SHIP_MAX_SPEED);
  //     break;
  //   case " ": // shoot a bullet
  //     if (bullets.length < BULLET_MAX) {
  //       const bdx = ship.noseX - ship.x;
  //       const bdy = ship.noseY - ship.y;
  //       const h = dist(ship.x, ship.y, ship.noseX, ship.noseY);
  //       const b = makeBullet(
  //         ship.noseX,
  //         ship.noseY,
  //         ship.dx + (bdx / h) * BULLET_SPEED,
  //         ship.dy + (bdy / h) * BULLET_SPEED
  //       );
  //       bullets.push(b);
  //       removeBulletAfterDelay(b, BULLET_LIFE_MS);
  //     }
  //     break;
  //   case "i":
  //   case "I": // toggle ship invincibility, for debugging/cheating
  //     ship.invincible = !ship.invincible;
  //     break;
  // } // switch
} // keyPressed

function keyReleased() {
  // stop turning the ship when a key is released
  if (ship.angleRate !== 0) {
    ship.angleRate = 0;
  }
}
