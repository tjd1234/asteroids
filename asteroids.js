// asteroids.js

//
// Bugs to fix:
// - Sometimes explosions are clearly wrong, i.e. it whips around in a way that
//   does not match other explosions. Maybe a calculation error in explosion
//   code?
//
// Bugs fixed:
// - Appears to be fixed by only going to next level when game state is
//   "playing", but tricky to test since it is hard to trigger. It's possible to
//   trigger the ship explosion without losing a ship. Seems to happen when near
//   level transition, e.g. maybe ship hits rock, but then maybe level
//   transition is set before game over occurs?
// - score not displayed during transition
//

//
// To do:
// - make the ship a Polygon triangle
// - add line and fill color to Polygon (so multi-colored rocks are possible!)
// - improve explosion animations
//   - e.g. make segments rotate around a random point on them
//   - e.g. add particles
// - add lives, i.e. 3 lives at start of game; game over when 0 lives
// - add thrusters animation when W pressed
// - show score numbers when rock is hit
// - add sounds effects for shooting, explosions, etc.
// - add jump to hyperspace (random location, random direction)
// - when W key is pressed, ship should continue to accelerate
// - when space key is pressed, ship should shoot a bullet
// - improve game over screen
// - filter out dead objects in-place instead of using filter()
// - use pre-defined bullets
//

//
// According to the game at freeasteroids.org:
// - the ship is an A-shape
// - asteroids explode into particles
// - the ship explodes into segments
// - scores: 20 for a small rock, 50 for a medium rock, 100 for a large rock
//

//
// helper code
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

function randSign() {
  return random(0, 1) < 0.5 ? 1 : -1;
}

//
// constants
//
const PLAYFIELD_WIDTH = 400;
const PLAYFIELD_HEIGHT = 400;
const PLAYFIELD_CENTER = { x: PLAYFIELD_WIDTH / 2, y: PLAYFIELD_HEIGHT / 2 };

const BG_COLOR = 0;
const OUTLINE_COLOR = 255;

const SHIP_DECEL = 0.003;
const SHIP_ANGLE_RATE = 4;
const SHIP_MAX_SPEED = 3;
const SHIP_ACCEL = 0.1;

// get a new ship every EXTRA_SHIP_SCORE points
const EXTRA_SHIP_SCORE_INCREMENT = 10000;

const RESPAWN_RADIUS = 100;
const RESPAWN_SHOW = false;

const BULLET_MAX = 5;
const BULLET_LIFE_MS = 1800;
const BULLET_SPEED = 3;
const BULLET_SIZE = 3;

const ROCK_MIN_SPEED = 0.25;
const ROCK_MAX_SPEED = 1;

const LEVEL_DELAY_MS = 2000;

const PARTICLE_MIN_SPEED = 0.25;
const PARTICLE_MAX_SPEED = 1;

const SHIP_EXPLOSION_DELAY_MS = 10 * 1000;
const SHIP_PARTICLE_MIN_SIZE = 2;
const SHIP_PARTICLE_MAX_SIZE = 4;

//
// Polygon class for rocks and ship
//
class Polygon {
  constructor(points) {
    // points should be an array of {x: number, y: number} objects
    this.points = points;

    this.pos = { x: 0, y: 0 };

    this.vel = { dx: 0, dy: 0 };
    this._angleInDegrees = 0;
    this.angleRateInDegrees = 0;
    this.size = 0;
    this.filled = false;
    this.drawCenter = false;
    this.drawCenterSegments = false;
    this.dead = false;
  }

  // Calculate the center point of the polygon
  getCenter() {
    let sumX = 0;
    let sumY = 0;
    for (const p of this.points) {
      sumX += p.x;
      sumY += p.y;
    }
    return {
      x: sumX / this.points.length,
      y: sumY / this.points.length,
    };
  }

  // Rotate the polygon around its center by the given angle (in radians)
  rotate(angleInRadians) {
    const center = this.getCenter();

    // Rotate each point around the center
    for (const point of this.points) {
      // Translate point to origin
      const dx = point.x - center.x;
      const dy = point.y - center.y;

      // Rotate point
      const cos = Math.cos(angleInRadians);
      const sin = Math.sin(angleInRadians);
      point.x = center.x + (dx * cos - dy * sin);
      point.y = center.y + (dx * sin + dy * cos);
    }
  }

  rotateDegrees(degrees) {
    this.rotate(degrees * (Math.PI / 180));
  }

  set angleInDegrees(d) {
    this._angleInDegrees = d;
    this.rotateDegrees(d);
  }

  get angleInDegrees() {
    return this._angleInDegrees;
  }

  update() {
    this.pos.x += this.vel.dx;
    this.pos.y += this.vel.dy;

    // wrap around the screen
    if (this.pos.x < 0) {
      this.pos.x = width;
    }
    if (this.pos.x > width) {
      this.pos.x = 0;
    }
    if (this.pos.y < 0) {
      this.pos.y = height;
    }
    if (this.pos.y > height) {
      this.pos.y = 0;
    }

    this.rotateDegrees(this.angleRateInDegrees);
  }

  draw() {
    push();
    if (this.filled) {
      fill(255);
      noStroke();
    } else {
      stroke(255);
      noFill();
    }
    translate(this.pos.x, this.pos.y);
    rotate(this.angle);

    // draw the polygon
    beginShape();
    for (const p of this.points) {
      vertex(p.x, p.y);
    }
    endShape(CLOSE);

    const center = this.getCenter();
    if (this.drawCenterSegments) {
      push();
      stroke(255);
      for (const p of this.points) {
        line(center.x, center.y, p.x, p.y);
      }
      pop();
    }
    if (this.drawCenter) {
      redDotAt(center.x, center.y);
    }
    pop();
  } // draw

  // Returns true if the point (x, y) is inside the polygon
  containsPoint(x, y) {
    x -= this.pos.x;
    y -= this.pos.y;
    let inside = false;

    // Loop through all edges of the polygon
    for (
      let i = 0, j = this.points.length - 1;
      i < this.points.length;
      j = i++
    ) {
      const xi = this.points[i].x;
      const yi = this.points[i].y;
      const xj = this.points[j].x;
      const yj = this.points[j].y;

      // check if point is on a horizontal edge
      if (
        yi === y &&
        yj === y &&
        x > Math.min(xi, xj) &&
        x < Math.max(xi, xj)
      ) {
        return true;
      }

      // Check if point is on a vertex
      if ((xi === x && yi === y) || (xj === x && yj === y)) {
        return true;
      }

      // ray casting algorithm
      if (yi > y !== yj > y) {
        const intersectX = ((xj - xi) * (y - yi)) / (yj - yi) + xi;
        if (x < intersectX) {
          inside = !inside;
        }
      }
    } // for

    return inside;
  } // containsPoint
} // Polygon

//
// game state
//
let gameState = {
  score: 0,
  level: 1,
  lives: 3,
  nextExtraShipScore: EXTRA_SHIP_SCORE_INCREMENT,
  highScore: 0,
  status: "playing", // "playing", "game over", "transitioning", "respawning"
  showStatus: false,
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
  rotatingLeft: false,
  rotatingRight: false,
  accelerating: false,
  dead: false,
  showNose: false,
  showCenter: false,
  invincible: false,
}; // ship

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

const rock_data = {
  small: {
    size: 20,
    sides: 6,
    score: 100,
  },
  medium: {
    size: 40,
    sides: 8,
    score: 50,
  },
  large: {
    size: 60,
    sides: 10,
    score: 20,
  },
}; // rock_data

// Generate n random points for a polygon within a given radius
function makeRandomPolygonPoints(n, maxRadius = 100) {
  const points = [];
  const angleStep = (2 * Math.PI) / n;

  angleMode(RADIANS);
  for (let i = 0; i < n; i++) {
    // Generate a random radius between 0.5 and 1 times the max radius. This
    // creates some irregularity in the shape.
    const randomRadius = maxRadius * (0.5 + Math.random() * 0.9);
    const angle = i * angleStep;

    points.push({
      x: randomRadius * Math.cos(angle),
      y: randomRadius * Math.sin(angle),
    });
  }

  return points;
}

function makeRandomRock(x, y, size, sides) {
  let shape = new Polygon(makeRandomPolygonPoints(sides, size * 0.5));
  shape.pos = { x: x, y: y };
  shape.vel = {
    dx: random(ROCK_MIN_SPEED, ROCK_MAX_SPEED) * randSign(),
    dy: random(ROCK_MIN_SPEED, ROCK_MAX_SPEED) * randSign(),
  };
  shape.angleInDegrees = 0;
  shape.angleRateInDegrees = randSign() * random(0.3, 1.5);
  shape.size = size;
  return shape;
}

function makeRandSmallRock(x, y) {
  return makeRandomRock(x, y, rock_data.small.size, rock_data.small.sides);
}

function makeRandMediumRock(x, y) {
  return makeRandomRock(x, y, rock_data.medium.size, rock_data.medium.sides);
}

function makeRandLargeRock(x, y) {
  return makeRandomRock(x, y, rock_data.large.size, rock_data.large.sides);
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

function addInitialLargeRocks(numRocks) {
  rocks = [];
  for (let i = 0; i < numRocks; i++) {
    rocks.push(makeRandLargeRock(randRockX(), randRockY()));
  } // for
}

//
// rock explosion animation
//
let rockExplosions = [];

//
// A rock explosion is an array of segments of the edges of the rock it's from.
// They rotate around their centers at random speeds and directions, move away
// from the center of the explosion, move slightly in the same direction as the
// original rock, and fade out as they go.
//
// Much of this was co-developed with Cursor AI. I would describe the behavior I
// wanted, and it would generate the code. I would then review it, and refine
// it. It was also helpful for finding bugs, e.g. I could highlight some code
// and ask it to find a bug (and suggest a fix). In general, it did a great job.
//
class RockExplosion {
  constructor(rock) {
    this.dead = false;
    this.segments = [];
    const n = rock.points.length;
    const inheritedSpeedScale = 0.5; // adjust how much of the rock's speed to inherit
    const explosionSpeed = 0.15; // adjust how fast the segments move outwards

    // store the rock's center for orbital rotation
    this.center = { ...rock.pos };
    this.orbitalSpeed = -random(0.5, 1.0); // -random(0.25, 0.5);

    // Create segments and give each one its own position, velocity and rotation
    for (let i = 0; i < n; i++) {
      const start = { ...rock.points[i] }; // clone the points
      const end = { ...rock.points[(i + 1) % n] };

      // calculate the midpoint of the segment (segments rotate around this point)
      const midpoint = {
        x: (start.x + end.x) / 2,
        y: (start.y + end.y) / 2,
      };
      const relativeStart = {
        x: start.x - midpoint.x,
        y: start.y - midpoint.y,
      };
      const relativeEnd = {
        x: end.x - midpoint.x,
        y: end.y - midpoint.y,
      };

      // calculate direction vector from rock center to segment midpoint
      const dirX = midpoint.x; // since rock points are already relative to center
      const dirY = midpoint.y;

      // normalize the direction vector and scale it
      const length = Math.sqrt(dirX * dirX + dirY * dirY);

      this.segments.push({
        start: relativeStart,
        end: relativeEnd,
        pos: { x: rock.pos.x + midpoint.x, y: rock.pos.y + midpoint.y },
        vel: {
          dx:
            (dirX / length) * explosionSpeed +
            rock.vel.dx * inheritedSpeedScale,
          dy:
            (dirY / length) * explosionSpeed +
            rock.vel.dy * inheritedSpeedScale,
        },
        angle: 0,
        angleRate: random(40, 75) * randSign(),
      });
    }
    this.alpha = 200; // for fade out effect
  }

  update() {
    this.alpha -= 2; // fade out
    for (const seg of this.segments) {
      // update position
      seg.pos.x += seg.vel.dx;
      seg.pos.y += seg.vel.dy;

      // add orbital rotation around original center
      const dx = seg.pos.x - this.center.x;
      const dy = seg.pos.y - this.center.y;
      const angle = (this.orbitalSpeed * Math.PI) / 180; // convert to radians
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);

      // rotate position around center
      seg.pos.x = this.center.x + dx * cos - dy * sin;
      seg.pos.y = this.center.y + dx * sin + dy * cos;

      // wrap around the screen
      if (seg.pos.x < 0) {
        seg.pos.x = width;
      }
      if (seg.pos.x > width) {
        seg.pos.x = 0;
      }
      if (seg.pos.y < 0) {
        seg.pos.y = height;
      }
      if (seg.pos.y > height) {
        seg.pos.y = 0;
      }

      // update rotation
      seg.angle += seg.angleRate;
    }
    if (this.alpha <= 0) {
      this.dead = true;
    }
  } // update

  draw() {
    push();
    stroke(255, this.alpha);
    noFill();
    for (const s of this.segments) {
      push();
      translate(s.pos.x, s.pos.y);
      rotate(radians(s.angle));
      line(s.start.x, s.start.y, s.end.x, s.end.y);
      pop();
    }
    pop();
  }
} // RockExplosion

function makeParticle(x, y, minSize, maxSize) {
  return {
    x,
    y,
    dx: random(PARTICLE_MIN_SPEED, PARTICLE_MAX_SPEED) * randSign(),
    dy: random(PARTICLE_MIN_SPEED, PARTICLE_MAX_SPEED) * randSign(),
    size: random(minSize, maxSize),
  };
}

function drawRockExplosions() {
  for (const e of rockExplosions) {
    e.draw();
  }
}

function updateRockExplosions() {
  for (const e of rockExplosions) {
    e.update();
  }
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
function initializeGame() {
  gameState.status = "playing";
  gameState.score = 0;
  gameState.lives = 3;
  gameState.level = 1;
  gameState.nextExtraShipScore = EXTRA_SHIP_SCORE_INCREMENT;
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
  createCanvas(PLAYFIELD_WIDTH, PLAYFIELD_HEIGHT);
  // noCursor(); // turn off the mouse pointer so we can see the ship

  initializeGame();
}

function draw() {
  background(0);

  
  push();
  // draw respawn circle
  noFill();
  // draw lines from screen center to rock centers
  let rockInRespawnCircle = false;
  for (const r of rocks) {
    const center = r.getCenter();
    const worldX = center.x + r.pos.x;
    const worldY = center.y + r.pos.y;
    if (
      dist(PLAYFIELD_CENTER.x, PLAYFIELD_CENTER.y, worldX, worldY) <
      RESPAWN_RADIUS
    ) {
      stroke(255, 0, 0);
      rockInRespawnCircle = true;
    } else {
      stroke(0, 255, 0);
    }
    if (RESPAWN_SHOW) {
      line(PLAYFIELD_CENTER.x, PLAYFIELD_CENTER.y, worldX, worldY);
    }
  } // for
  if (rockInRespawnCircle) {
    stroke(255, 0, 0);
  } else {
    stroke(0, 255, 0);
  }
  if (RESPAWN_SHOW) {
    ellipse(
      PLAYFIELD_CENTER.x,
      PLAYFIELD_CENTER.y,
      RESPAWN_RADIUS,
      RESPAWN_RADIUS
    );
  }
  pop();

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

    drawScore();
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

    drawScore();
  } else if (gameState.status === "respawning") {
    if (!rockInRespawnCircle) {
      console.log("respawning");
      gameState.status = "playing";
      ship.x = width / 2;
      ship.y = height / 2;
      ship.dx = 0;
      ship.dy = 0;
      ship.angle = 0;
      ship.angleRate = 0;
    }
    updateBullets();
    drawBullets();

    updateRocks();
    drawRocks();

    updateRockExplosions();
    drawRockExplosions();

    updateShipExplosions();
    drawShipExplosions();

    drawScore();

  }
} // draw

// function respawnCircleClear() {
//   // if there are no rocks in/intersecting the respawn circle, respawn the ship
//   for (const r of rocks) {
//     const center = r.getCenter();
//     // Add the rock's position to get world coordinates
//     const worldX = center.x + r.pos.x;
//     const worldY = center.y + r.pos.y;
//     const distance = dist(worldX, worldY, PLAYFIELD_CENTER.x, PLAYFIELD_CENTER.y);
//     const threshold = RESPAWN_RADIUS + r.size / 2;

//     if (distance < threshold) {
//       return false;
//     }
//   }
//   return true;
// }

function drawShipBody() {
  // draw the ship: triangle(nose, left wing, right wing)
  triangle(
    0,
    -ship.height / 2,
    -ship.width / 2,
    ship.height / 2,
    ship.width / 2,
    ship.height / 2
  );
}

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

  drawShipBody();

  pop();

  if (ship.showNose) {
    redDotAt(ship.noseX, ship.noseY);
  }
  if (ship.showCenter) {
    greenDotAt(ship.x, ship.y);
  }
}

function updateShip() {
  if (ship.accelerating) {
    const angle = ship.angle * (Math.PI / 180);
    ship.dx += SHIP_ACCEL * Math.sin(angle);
    ship.dy += -SHIP_ACCEL * Math.cos(angle);
  }

  // Apply max speed constraint after acceleration
  const currentSpeed = sqrt(ship.dx * ship.dx + ship.dy * ship.dy);
  if (currentSpeed > SHIP_MAX_SPEED) {
    const scale = SHIP_MAX_SPEED / currentSpeed;
    ship.dx *= scale;
    ship.dy *= scale;
  }

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
  if (ship.rotatingLeft) {
    ship.angleRate = -SHIP_ANGLE_RATE;
  } else if (ship.rotatingRight) {
    ship.angleRate = SHIP_ANGLE_RATE;
  } else {
    ship.angleRate = 0;
  }
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

function drawRocks() {
  push();

  noFill();
  for (const r of rocks) {
    r.draw();
  }

  pop();
} // drawRocks

function updateRocks() {
  // to use P5's sin and cos need to use radians
  for (const r of rocks) {
    // check if the ship hit the rock
    if (
      r.containsPoint(ship.x, ship.y) &&
      !ship.invincible &&
      gameState.status === "playing"
    ) {
      if (gameState.lives > 0) {
        gameState.status = "respawning";
        gameState.lives--;
      } else {
        gameState.status = "game over";
      }
      const e = makeShipExplosion(ship);
      shipExplosions.push(e);
      removeShipExplosionAfterDelay(e);
    } else if (
      r.containsPoint(ship.noseX, ship.noseY) &&
      !ship.invincible &&
      gameState.status === "playing"
    ) {
      if (gameState.lives > 0) {
        gameState.status = "respawning";
        gameState.lives--;
      } else {
        gameState.status = "game over";
      }
      const e = makeShipExplosion(ship);
      shipExplosions.push(e);
      removeShipExplosionAfterDelay(e);
    }

    // check if a bullet hit the rock
    let hit = false;
    for (const b of bullets) {
      if (r.containsPoint(b.x, b.y)) {
        hit = true;
        b.dead = true;

        // add explosion
        const e = new RockExplosion(r);
        rockExplosions.push(e);

        // rocks explode into other rocks
        switch (r.size) {
          case rock_data.small.size: // remove small rock
            gameState.score += rock_data.small.score;
            gameState.highScore = Math.max(
              gameState.highScore,
              gameState.score
            );
            r.dead = true;
            break;
          case rock_data.medium.size: // split medium rock into two small rocks
            gameState.score += rock_data.medium.score;
            gameState.highScore = Math.max(
              gameState.highScore,
              gameState.score
            );
            r.dead = true;
            rocks.push(makeRandSmallRock(r.pos.x, r.pos.y));
            rocks.push(makeRandSmallRock(r.pos.x, r.pos.y));
            break;
          case rock_data.large.size: // split large rock into two medium rocks
            gameState.score += rock_data.large.score;
            gameState.highScore = Math.max(
              gameState.highScore,
              gameState.score
            );
            r.dead = true;
            rocks.push(makeRandMediumRock(r.pos.x, r.pos.y));
            rocks.push(makeRandMediumRock(r.pos.x, r.pos.y));
            break;
        } // switch
      } // if hitRock
    } // for bullets

    // check if we need to add a new ship
    if (gameState.score >= gameState.nextExtraShipScore) {
      gameState.lives++;
      gameState.nextExtraShipScore += EXTRA_SHIP_SCORE_INCREMENT;
    }
    // allow at most 10 ships
    gameState.lives = Math.min(gameState.lives, 10);

    // if hit a rock, skip to next rock
    if (hit) continue;

    // move the rock
    r.update();
  } // for

  // remove dead rocks
  rocks = rocks.filter((r) => !r.dead);

  // go to the next level if all rocks are dead
  if (rocks.length === 0 && gameState.status === "playing") {
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
  // current score
  textSize(score.fontSize);
  fill("green");
  text(gameState.score.toString(), score.x, score.y);

  // show remaining ships (not including the one currently playing/respawning)
  push();
  scale(0.75); // make score ships smaller
  noFill();
  stroke(255);
  let x = 90;
  for (let i = 0; i < gameState.lives - 1; i++) {
    push();
    translate(x, score.y - 6);
    drawShipBody();
    x += ship.width + 3;
    pop();
  }
  pop();

  // high score
  textSize(score.fontSize);
  fill("yellow");
  text(`High Score: ${gameState.highScore}`, score.x + 250, score.y);
  pop();

  // show current game state
  if (gameState.showStatus) {
    textSize(score.fontSize);
    fill("white");
    text(`Status: ${gameState.status}`, score.x + 100, score.y);
  }
}

function drawGameOver() {
  push();
  textSize(score.fontSize);
  fill("red");
  text(`Game Over: ${gameState.score}`, width / 2 - 75, height / 2);
  text("Press P to play again", width / 2 - 100, height / 2 + 20);
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
  if (gameState.status === "game over") {
    if (key === "p" || key === "P") {
      initializeGame();
    }
  }

  // only check for user actions if the game is playing or transitioning
  if (!["playing", "transitioning"].includes(gameState.status)) return;

  if (userActions.left.includes(key)) {
    ship.rotatingLeft = true;
    ship.rotatingRight = false;
  } else if (userActions.right.includes(key)) {
    ship.rotatingRight = true;
    ship.rotatingLeft = false;
  } else if (userActions.accelerate.includes(key)) {
    ship.accelerating = true;
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
} // keyPressed

function keyReleased() {
  if (userActions.left.includes(key)) {
    ship.rotatingLeft = false;
  } else if (userActions.right.includes(key)) {
    ship.rotatingRight = false;
  } else if (userActions.accelerate.includes(key)) {
    ship.accelerating = false;
  }
} // keyReleased
