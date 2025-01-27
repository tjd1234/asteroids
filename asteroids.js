// asteroids.js

//
// Bugs to fix:
// - Sometimes when respawning the ship instantly explodes in the center of the
//   screen, even though there are no rocks nearby.
//
// Bugs fixed:
// - Fixed (hopefully) by removing orbital rotation in explosions. It doesn't
//   make the explosions look that much better, and it simplifies the code.
//   Sometimes explosions are clearly wrong, i.e. it whips around in a way that
//   does not match other explosions. Maybe a calculation error in explosion
//   code?
// - Fixed by adding extra ship in score if needed. A bit of a hack, but it
//   seems to work. Don't remove scoreboard ship until it is placed on the
//   screen. Otherwise, while waiting for respawn it looks like nothing is
//   happening.
// - Fixed by setting left, right, and acceleration flags to false when
//   re-initializing. Sometimes after respawning the shift left, right, and
//   thrusters are not working. Shooting works, but sometimes at a weird angle.
// - Fixed by adding "explosion" state to guarantee some time before new ship is
//   respawned. Seems to have fixed double explosion problem. Sometimes a ship
//   explosion occurs twice: once where it hits a rock (where it should be), and
//   then, sometimes, a second explosion occurs in the center of the screen. I
//   think it has to do with an error in the logic of the state transitions.
// - Fixed, apparently, by only going to next level when game state is
//   "playing", but tricky to test since it is hard to trigger. It's possible to
//   trigger the ship explosion without losing a ship. Seems to happen when near
//   level transition, e.g. maybe ship hits rock, but then maybe level
//   transition is set before game over occurs?
// - Fixed by displaying score during transition.
//

//
// To do:
// - add big and small UFOs
// - add explosion constants to SHIP
// - improve explosion animations
//   - e.g. make segments rotate around a random point on them
//   - e.g. add particles
// - show score numbers when rock is hit
// - add sounds effects for shooting, explosions, etc.
// - add jump to hyperspace (random location, random direction)
// - when W key is pressed, ship should continue to accelerate
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

function wrapCoordinate(value, max) {
    if (value < 0) return max - 1;
    if (value >= max) return 0;
    return value;
}

//
// constants
//

const PLAYFIELD = {
    width: 400,
    height: 400,
    center: { x: 200, y: 200 },
};

const COLOR = {
    bg: 0,
    outline: 255,
};

const SHIP_WIDTH = 14;
const SHIP_HEIGHT = 20;

const SHIP_NOSE = { x: 0, y: -SHIP_HEIGHT / 2 };
const SHIP_LEFT = { x: -SHIP_WIDTH / 2, y: SHIP_HEIGHT / 2 };
const SHIP_RIGHT = { x: SHIP_WIDTH / 2, y: SHIP_HEIGHT / 2 };
const SHIP_BODY = [SHIP_NOSE, SHIP_LEFT, SHIP_RIGHT];

// the thrust is a small triangle at the back of the ship
const SHIP_THRUST = [SHIP_LEFT, SHIP_RIGHT, { x: 0, y: SHIP_HEIGHT / 2 + 5 }];

const SHIP = {
    width: SHIP_WIDTH,
    height: SHIP_HEIGHT,
    body: SHIP_BODY,
    decel: 0.003,
    angleRate: 4,
    maxSpeed: 3,
    accel: 0.1,
    startLives: 3,
    maxLives: 10 + 1,
    extraShipScoreIncrement: 10000,
    explosionDelayMS: 5 * 1000,
    respawn: {
        radius: 100,
        show: false,
    },
    particle: {
        // explosion particles
        minSpeed: 0.25,
        maxSpeed: 1,
        minSize: 2,
        maxSize: 4,
    },
};

// after ship explodes, wait this long before respawning
const DELAY_TO_RESPAWN = 2 * 1000;
const LEVEL_DELAY_MS = 2000;

const BULLET = {
    max: 5,
    lifeMS: 1800,
    speed: 3,
    size: 3,
};

const ROCK = {
    speed: {
        min: 0.25,
        max: 1,
    },
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
}; // ROCK

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
        this.strokeColor = 255;
        this.fillColor = 0;
        this.filled = false;
        this.showCenter = false;
        this.showCenterSegments = false;
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
        const cos = Math.cos(angleInRadians);
        const sin = Math.sin(angleInRadians);

        // Rotate each point around the center
        for (const point of this.points) {
            // translate point to origin
            const dx = point.x - center.x;
            const dy = point.y - center.y;

            // rotate point
            point.x = center.x + (dx * cos - dy * sin);
            point.y = center.y + (dx * sin + dy * cos);
        }
        this._angleInDegrees = (this._angleInDegrees + angleInRadians) % 360;
    }

    rotateDegrees(degrees) {
        this.rotate(degrees * (Math.PI / 180));
    }

    set angleInDegrees(d) {
        this._angleInDegrees = d;
    }

    get angleInDegrees() {
        return this._angleInDegrees;
    }

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
const state = {
    playing: "playing",
    gameOver: "game over",
    transitioning: "transitioning", // between levels
    exploding: "exploding", // ship is exploding
    respawning: "respawning", // in this state waiting for clear space to respawn ship
};

let game = {
    score: 0,
    level: 1,
    lives: SHIP.startLives,
    nextExtraShipScore: SHIP.extraShipScoreIncrement,
    highScore: 0,
    shotsFired: 0,
    rocksHit: 0,
    status: state.playing,
    showStatus: false, // for debugging
};

//
// the player's ship
//
const ship = {
    body: new Polygon(structuredClone(SHIP.body)),
    thrust: new Polygon(structuredClone(SHIP_THRUST)),
    fillColor: COLOR.bg,
    outlineColor: COLOR.outline,
    rotatingLeft: false,
    rotatingRight: false,
    accelerating: false,
    flashing: false, // flashes for a few seconds after respawning
    dead: false,
    showCenter: false,
    invincible: false,
}; // ship

//
// bullets
//
let bullets = [];

function makeBullet(x, y, dx, dy) {
    const bullet = {
        x, // short-hand for x: x, y: y, dx: dx, dy: dy
        y,
        dx,
        dy,
        fillColor: COLOR.bg,
        outlineColor: COLOR.outline,
        dead: false,
    };
    return bullet;
}

//
// asteroids
//
let rocks = [];

// Generate n random points for a polygon within a given radius
function makeRandomPolygonPoints(n, maxRadius) {
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
        dx: random(ROCK.speed.min, ROCK.speed.max) * randSign(),
        dy: random(ROCK.speed.min, ROCK.speed.max) * randSign(),
    };
    shape.angleInDegrees = 0;
    shape.angleRateInDegrees = randSign() * random(0.3, 1.5);
    shape.size = size;
    return shape;
}

function makeRandSmallRock(x, y) {
    return makeRandomRock(x, y, ROCK.small.size, ROCK.small.sides);
}

function makeRandMediumRock(x, y) {
    return makeRandomRock(x, y, ROCK.medium.size, ROCK.medium.sides);
}

function makeRandLargeRock(x, y) {
    return makeRandomRock(x, y, ROCK.large.size, ROCK.large.sides);
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
        const inheritedSpeedScale = 0.5; // how much of the rock's speed to inherit
        const explosionSpeed = 0.15; // how fast the segments move outwards

        // create segments and give each one its own position, velocity and rotation
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

            // add some randomness to the velocity to make the explosion look
            // more natural
            this.segments.push({
                start: relativeStart,
                end: relativeEnd,
                pos: { x: rock.pos.x + midpoint.x, y: rock.pos.y + midpoint.y },
                vel: {
                    dx:
                        random(-0.25, 0.25) +
                        (dirX / length) * explosionSpeed +
                        rock.vel.dx * inheritedSpeedScale,
                    dy:
                        random(-0.25, 0.25) +
                        (dirY / length) * explosionSpeed +
                        rock.vel.dy * inheritedSpeedScale,
                },
                angle: 0,
                angleRate: random(2, 15) * randSign(),
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

            // wrap around the screen
            seg.pos.x = wrapCoordinate(seg.pos.x, width);
            seg.pos.y = wrapCoordinate(seg.pos.y, height);

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

function makeParticle(x, y) {
    return {
        x,
        y,
        dx: random(SHIP.particle.minSpeed, SHIP.particle.maxSpeed) * randSign(),
        dy: random(SHIP.particle.minSpeed, SHIP.particle.maxSpeed) * randSign(),
        size: random(SHIP.particle.minSize, SHIP.particle.maxSize),
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
let shipExplosion = null;

function makeShipExplosion(ship) {
    const particles = Array(20)
        .fill()
        .map(() => makeParticle(ship.body.pos.x, ship.body.pos.y));
    return particles;
}

function removeShipExplosionAfterDelay(e) {
    setTimeout(() => {
        shipExplosion = null;
    }, SHIP.explosionDelayMS);
}

function drawShipExplosion() {
    if (shipExplosion === null) return;
    push();
    noStroke();
    for (const p of shipExplosion) {
        fill(255, 0, 0);
        rect(p.x, p.y, p.size, p.size);
    }
    pop();
}

function updateShipExplosion() {
    if (shipExplosion === null) return;
    for (const p of shipExplosion) {
        p.x += p.dx;
        p.y += p.dy;
        // wrap around the screen
        p.x = wrapCoordinate(p.x, width);
        p.y = wrapCoordinate(p.y, height);
    } // for
} // updateShipExplosion

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
    game.status = state.playing;
    game.score = 0;
    game.lives = SHIP.startLives;
    game.level = 1;
    game.nextExtraShipScore = SHIP.extraShipScoreIncrement;
    game.shotsFired = 0;
    game.rocksHit = 0;

    bullets = [];

    shipExplosion = null;

    rockExplosions = [];
    rocks = [];
    addInitialLargeRocks(3);

    ship.body.points = structuredClone(SHIP.body);
    ship.body.pos.x = PLAYFIELD.center.x;
    ship.body.pos.y = PLAYFIELD.center.y;
    ship.body.vel.dx = 0;
    ship.body.vel.dy = 0;
    ship.body.angleInDegrees = 0;
    ship.body.angleRateInDegrees = 0;
    ship.rotatingLeft = false;
    ship.rotatingRight = false;
    ship.accelerating = false;
    ship.dead = false;
    ship.invincible = false;
    ship.thrust.strokeColor = "#ffa500"; // orange
    ship.thrust.fillColor = "#ffa500"; // orange
    ship.thrust.filled = true;
} // initializeGame

//
// main setup and draw functions
//
function setup() {
    createCanvas(PLAYFIELD.width, PLAYFIELD.height);
    // noCursor(); // turn off the mouse pointer so we can see the ship

    initializeGame();
}

function draw() {
    background(0);

    push();

    // debug code for respawn circle

    noFill();
    // draw lines from screen center to rock centers
    let rockInRespawnCircle = false;
    for (const r of rocks) {
        const center = r.getCenter();
        const worldX = center.x + r.pos.x;
        const worldY = center.y + r.pos.y;
        if (
            dist(PLAYFIELD.center.x, PLAYFIELD.center.y, worldX, worldY) <
            SHIP.respawn.radius
        ) {
            stroke(255, 0, 0);
            rockInRespawnCircle = true;
        } else {
            stroke(0, 255, 0);
        }
        if (SHIP.respawn.show) {
            line(PLAYFIELD.center.x, PLAYFIELD.center.y, worldX, worldY);
        }
    } // for
    if (SHIP.respawn.show) {
        if (rockInRespawnCircle) {
            stroke(255, 0, 0);
        } else {
            stroke(0, 255, 0);
        }
        ellipse(
            PLAYFIELD.center.x,
            PLAYFIELD.center.y,
            SHIP.respawn.radius,
            SHIP.respawn.radius
        );
    }
    pop();

    if (game.status === state.playing) {
        updateShip();
        drawShip();

        updateBullets();
        drawBullets();

        updateRocks();
        drawRocks();

        updateRockExplosions();
        drawRockExplosions();

        updateShipExplosion();
        drawShipExplosion();

        drawScore();
    } else if (game.status === state.gameOver) {
        updateBullets();
        drawBullets();

        updateRocks();
        drawRocks();

        updateRockExplosions();
        drawRockExplosions();

        updateShipExplosion();
        drawShipExplosion();

        drawScore();
        drawGameOver();
    } else if (game.status === state.transitioning) {
        updateShip();
        drawShip();

        updateBullets();
        drawBullets();

        updateRockExplosions();
        drawRockExplosions();

        updateShipExplosion();
        drawShipExplosion();

        drawScore();
    } else if (game.status === state.exploding) {
        updateBullets();
        drawBullets();

        updateRocks();
        drawRocks();

        updateRockExplosions();
        drawRockExplosions();

        updateShipExplosion();
        drawShipExplosion();

        drawScore();
    } else if (game.status === state.respawning) {
        if (!rockInRespawnCircle) {
            game.status = state.playing;
            ship.dead = false;
            ship.flashing = true;
            setTimeout(() => {
                ship.flashing = false;
            }, 1000);
            ship.body.pos.x = width / 2;
            ship.body.pos.y = height / 2;
            ship.body.vel.dx = 0;
            ship.body.vel.dy = 0;
            ship.body.points = structuredClone(SHIP.body);
            ship.body.angleInDegrees = 0;
            ship.body.angleRateInDegrees = 0;
            ship.rotatingLeft = false;
            ship.rotatingRight = false;
            ship.accelerating = false;
        }
        updateBullets();
        drawBullets();

        updateRocks();
        drawRocks();

        updateRockExplosions();
        drawRockExplosions();

        updateShipExplosion();
        drawShipExplosion();

        drawScore();
    }
} // draw

function drawShip() {
    // Don't draw the ship every other frame when flashing
    if (ship.flashing && frameCount % 15 < 5) return;

    push();
    translate(ship.body.pos.x, ship.body.pos.y);
    rotate(radians(ship.body.angleInDegrees));

    if (ship.invincible) {
        stroke(255, 255, 0);
    } else {
        stroke(255);
    }
    noFill();

    beginShape();
    for (const p of SHIP_BODY) {
        // use original SHIP_BODY points
        vertex(p.x, p.y);
    }
    endShape(CLOSE);

    // draw thrust
    if (ship.accelerating) {
        fill("#ff8c00"); // dark orange
        noStroke();
        // Draw thrust triangle directly using the original SHIP_THRUST points
        beginShape();
        vertex(-SHIP_WIDTH / 2, SHIP_HEIGHT / 2); // left base point
        vertex(SHIP_WIDTH / 2, SHIP_HEIGHT / 2); // right base point
        vertex(0, SHIP_HEIGHT / 2 + 8); // bottom point
        endShape(CLOSE);
    }
    pop();

    if (ship.showCenter) {
        greenDotAt(ship.body.pos.x, ship.body.pos.y);
    }
} // drawShip

function updateShip() {
    if (ship.dead) return;

    if (ship.accelerating) {
        const angleRadians = ship.body.angleInDegrees * (Math.PI / 180);
        ship.body.vel.dx += SHIP.accel * Math.sin(angleRadians);
        ship.body.vel.dy += -SHIP.accel * Math.cos(angleRadians);
    }

    // Apply max speed constraint after acceleration
    const currentSpeed = sqrt(
        ship.body.vel.dx * ship.body.vel.dx +
            ship.body.vel.dy * ship.body.vel.dy
    );
    if (currentSpeed > SHIP.maxSpeed) {
        const scale = SHIP.maxSpeed / currentSpeed;
        ship.body.vel.dx *= scale;
        ship.body.vel.dy *= scale;
    }

    // decrease velocity of ship
    ship.body.vel.dx =
        ship.body.vel.dx > 0
            ? Math.max(0, ship.body.vel.dx - SHIP.decel)
            : Math.min(0, ship.body.vel.dx + SHIP.decel);

    ship.body.vel.dy =
        ship.body.vel.dy > 0
            ? Math.max(0, ship.body.vel.dy - SHIP.decel)
            : Math.min(0, ship.body.vel.dy + SHIP.decel);

    // update angle of ship
    if (ship.rotatingLeft) {
        ship.body.angleRateInDegrees = -SHIP.angleRate;
    } else if (ship.rotatingRight) {
        ship.body.angleRateInDegrees = SHIP.angleRate;
    } else {
        ship.body.angleRateInDegrees = 0;
    }

    // update ship body
    ship.body.pos.x += ship.body.vel.dx;
    ship.body.pos.y += ship.body.vel.dy;

    // wrap around the screen
    ship.body.pos.x = wrapCoordinate(ship.body.pos.x, width);
    ship.body.pos.y = wrapCoordinate(ship.body.pos.y, height);

    // update the angle by adding the rotation rate
    if (ship.body.angleRateInDegrees !== 0) {
        ship.body.angleInDegrees += ship.body.angleRateInDegrees;
        ship.body.rotateDegrees(ship.body.angleRateInDegrees);
    }

    // update thrust points to match ship's rotation
    const angleRadians = ship.body.angleInDegrees * (Math.PI / 180);
    const cos = Math.cos(angleRadians);
    const sin = Math.sin(angleRadians);

    ship.thrust.points = SHIP_THRUST.map((point) => ({
        x: point.x * cos - point.y * sin,
        y: point.x * sin + point.y * cos,
    }));
} // updateShip

//
// bullet functions
//
function drawBullets() {
    push();

    for (const b of bullets) {
        fill(b.outlineColor);
        stroke(b.outlineColor);
        ellipse(b.x, b.y, BULLET.size, BULLET.size);
    }

    pop();
} // drawBullets

function updateBullets() {
    for (const b of bullets) {
        b.x += b.dx;
        b.y += b.dy;
        b.x = wrapCoordinate(b.x, width);
        b.y = wrapCoordinate(b.y, height);
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

function drawRock(rock) {
    push();
    if (rock.filled) {
        fill(rock.fillColor);
        noStroke();
    } else {
        stroke(rock.strokeColor);
        noFill();
    }
    translate(rock.pos.x, rock.pos.y);

    // draw the polygon
    beginShape();
    for (const p of rock.points) {
        vertex(p.x, p.y);
    }
    endShape(CLOSE);

    if (rock.showCenterSegments) {
        const center = rock.getCenter();
        push();
        stroke(rock.strokeColor);
        for (const p of rock.points) {
            line(center.x, center.y, p.x, p.y);
        }
        pop();
    }
    if (rock.showCenter) {
        const center = rock.getCenter();
        redDotAt(center.x, center.y);
    }
    pop();
} // draw

function drawRocks() {
    push();

    noFill();
    for (const r of rocks) {
        drawRock(r);
    }

    pop();
} // drawRocks

function updateRocks() {
    for (const r of rocks) {
        // check if any point of the ship is inside the rock
        let shipHitRock = false;
        if (!ship.invincible && game.status === state.playing) {
            for (const point of ship.body.points) {
                const worldX = point.x + ship.body.pos.x;
                const worldY = point.y + ship.body.pos.y;

                if (r.containsPoint(worldX, worldY)) {
                    shipHitRock = true;
                    break;
                }
            }
        }

        if (shipHitRock) {
            if (game.lives > 1) {
                game.lives--;
                game.status = state.exploding;
                setTimeout(() => {
                    game.status = state.respawning;
                }, DELAY_TO_RESPAWN);
            } else {
                game.status = state.gameOver;
            }
            const e = makeShipExplosion(ship);
            shipExplosion = e;
            removeShipExplosionAfterDelay(e);
            ship.dead = true;
        }

        // check if a bullet hit the rock
        let hit = false;
        for (const b of bullets) {
            if (r.containsPoint(b.x, b.y)) {
                game.rocksHit++;
                hit = true;
                b.dead = true;

                // add explosion
                const e = new RockExplosion(r);
                rockExplosions.push(e);

                // rocks explode into other rocks
                switch (r.size) {
                    case ROCK.small.size: // remove small rock
                        game.score += ROCK.small.score;
                        game.highScore = Math.max(game.highScore, game.score);
                        r.dead = true;
                        break;
                    case ROCK.medium.size: // split medium rock into two small rocks
                        game.score += ROCK.medium.score;
                        game.highScore = Math.max(game.highScore, game.score);
                        r.dead = true;
                        rocks.push(makeRandSmallRock(r.pos.x, r.pos.y));
                        rocks.push(makeRandSmallRock(r.pos.x, r.pos.y));
                        break;
                    case ROCK.large.size: // split large rock into two medium rocks
                        game.score += ROCK.large.score;
                        game.highScore = Math.max(game.highScore, game.score);
                        r.dead = true;
                        rocks.push(makeRandMediumRock(r.pos.x, r.pos.y));
                        rocks.push(makeRandMediumRock(r.pos.x, r.pos.y));
                        break;
                } // switch
            } // if hitRock
        } // for bullets

        // if rock is hit, skip to next rock without updating it (it's dead)
        if (hit) continue;

        // move the rock
        r.pos.x += r.vel.dx;
        r.pos.y += r.vel.dy;

        // wrap around the screen
        r.pos.x = wrapCoordinate(r.pos.x, width);
        r.pos.y = wrapCoordinate(r.pos.y, height);

        // Update the angle by adding the rotation rate
        if (r.angleRateInDegrees !== 0) {
            r._angleInDegrees += r.angleRateInDegrees;
            r.rotateDegrees(r.angleRateInDegrees);
        }
    } // for

    // remove dead rocks
    rocks = rocks.filter((r) => !r.dead);

    // check if we need to add a new ship
    if (game.score >= game.nextExtraShipScore) {
        game.lives++;
        game.nextExtraShipScore += SHIP.extraShipScoreIncrement;
    }
    // allow at most MAX_EXTRA_SHIPS ships
    if (game.lives > SHIP.maxLives) {
        game.lives = SHIP.maxLives;
    }

    // go to the next level if all rocks are dead
    if (rocks.length === 0 && game.status === state.playing) {
        game.status = state.transitioning;
        setTimeout(() => {
            game.level++;
            addInitialLargeRocks(Math.min(5, 2 + game.level));
            game.status = state.playing;
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
    text(game.score.toString(), score.x, score.y);

    // show remaining ships (not including the one currently playing/respawning)
    push();
    scale(0.75); // make score ships smaller
    noFill();
    stroke(255);
    let x = 90;

    // After a ship explodes, we show one extra ship in reserve so that the player
    // can see that the ship is respawning.
    let extra = 0;
    if (game.status === state.respawning || game.status === state.exploding) {
        extra = 1;
    }
    for (let i = 0; i < game.lives - 1 + extra; i++) {
        push();
        translate(x, score.y - 6);
        beginShape();
        for (const p of SHIP.body) {
            vertex(p.x, p.y);
        }
        endShape(CLOSE);
        x += SHIP.width + 3;
        pop();
    }
    pop();

    // high score
    textSize(score.fontSize);
    fill("yellow");
    text(`High Score: ${game.highScore}`, score.x + 250, score.y);
    pop();

    // show current game state
    if (game.showStatus) {
        textSize(score.fontSize);
        fill("white");
        text(`Status: ${game.status}`, score.x + 100, score.y);
    }

    // show shooting accuracy, i.e. shots fired / rocks hit
    if (game.shotsFired > 0) {
        fill("white");
        const accuracy = (100 * game.rocksHit) / game.shotsFired;
        text(`${accuracy.toFixed(1)}%`, score.x + 100, score.y);
    }
} // drawScore

function drawGameOver() {
    push();
    textSize(score.fontSize);
    fill("red");
    text(`Game Over: ${game.score}`, width / 2 - 75, height / 2);
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
    if (game.status === state.gameOver) {
        if (key === "p" || key === "P") {
            initializeGame();
        }
    }

    // only check for user actions if the game is playing or transitioning
    if (![state.playing, state.transitioning].includes(game.status)) return;

    if (userActions.left.includes(key)) {
        ship.rotatingLeft = true;
        ship.rotatingRight = false;
    } else if (userActions.right.includes(key)) {
        ship.rotatingRight = true;
        ship.rotatingLeft = false;
    } else if (userActions.accelerate.includes(key)) {
        ship.accelerating = true;
    } else if (userActions.shoot.includes(key)) {
        if (bullets.length < BULLET.max) {
            game.shotsFired++;
            const angleInRadians = ship.body.angleInDegrees * (Math.PI / 180);

            // calculate bullet direction based on ship's angle
            const bulletSpeed = BULLET.speed;
            const bdx = Math.sin(angleInRadians) * bulletSpeed;
            const bdy = -Math.cos(angleInRadians) * bulletSpeed;

            // use the ship's actual rotated nose point
            const noseX = ship.body.points[0].x + ship.body.pos.x;
            const noseY = ship.body.points[0].y + ship.body.pos.y;
            const b = makeBullet(
                noseX,
                noseY,
                ship.body.vel.dx + bdx,
                ship.body.vel.dy + bdy
            );
            bullets.push(b);
            removeBulletAfterDelay(b, BULLET.lifeMS);
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
