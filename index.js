'use strict';

class Vector {
	constructor(x = 0, y = 0) {
		this.x = x;
		this.y = y;
	}

	plus(vector) {
		if (!(vector instanceof Vector)) {
			throw new Error('Можно прибавлять к вектору только вектор типа Vector');
		}

		return new Vector(this.x + vector.x, this.y + vector.y);
	}

	times(multiplier) {
		return new Vector(this.x * multiplier, this.y * multiplier);
	}
}

class Actor {
	constructor(pos = new Vector(0, 0), size = new Vector(1, 1), speed = new Vector(0, 0)) {
		if (!(pos instanceof Vector) || !(size instanceof Vector) || !(speed instanceof Vector)) {
			throw new Error();
		}
		this.pos = pos;
		this.size = size;
		this.speed = speed;
	}

	act() {}

	get left() {
		return this.pos.x;
	}

	get top() {
		return this.pos.y;
	}

	get right() {
		return this.pos.x + this.size.x;
	}

	get bottom() {
		return this.pos.y + this.size.y;
	}

	get type() {
		return 'actor';
	}

	isIntersect(actor) {
		if (actor === undefined || !(actor instanceof Actor)) {
			throw new Error();
		}

		if (actor === this) {
			return false;
		}

		if (this.left >= actor.right || this.top >= actor.bottom || actor.left >= this.right || actor.top >= this.bottom) {
			return false;
		} else return true;
	}
}

class Level {
	constructor(grid = [], actors = []) {
		this.grid = grid;
		this.actors = actors;
		this.player = this.actors.find(function(x) { return x.type === 'player'; });
		this.height = this.grid.length;
		this.width = Math.max(0, ...this.grid.map(x => x.length));
		this.status = null;
		this.finishDelay = 1;
	}

	isFinished() {
		if (this.status !== null && this.finishDelay < 0) {
			return true;
		} else return false;
	} 

	actorAt(actor) {
		if (actor === undefined || !(actor instanceof Actor)) {
			throw new Error();
		}

		return this.actors.find(function(x) { return x.isIntersect(actor)});
	}

	obstacleAt(pos, size) {
		if (!(pos instanceof Vector) || !(size instanceof Vector)) {
			throw new Error();
		}

		let actor = new Actor(pos, size);

		if (actor.bottom > this.height) {
			return 'lava';
		}

		if (actor.left < 0 || actor.top < 0 || actor.right > this.width) {
			return 'wall'
		}

		for (let i = Math.floor(actor.left); i < actor.right; i++) {
			for (let j = Math.floor(actor.top); j < actor.bottom; j++) {
				if (this.grid[j][i] !== undefined) {
					return this.grid[j][i];
				}
			}
		}

		return undefined;
	}

	removeActor(actor) {
		let index = this.actors.findIndex(x => x === actor);
		if (index !== -1) {
			this.actors.splice(index, 1);
		}
	}

	noMoreActors(type) {
		return this.actors.every(x => x.type !== type);
	}

	playerTouched(type, actor) {
		if (this.status !== null) {
			return;
		}

		if (type === 'lava' || type === 'fireball') {
			this.status = 'lost';
			return;
		}

		if (type === 'coin' && actor !== undefined && actor.type === 'coin') {
			this.removeActor(actor);
			if (this.noMoreActors('coin')) {
				this.status = 'won';
			}
		}
	}
}

class LevelParser {
	constructor(dict) {
		this.dict = dict;
	}

	actorFromSymbol(char) {
		if (this.dict !== undefined && char !== undefined && char in this.dict) {
			return this.dict[char];
		}
		return undefined;
	}

	obstacleFromSymbol(char) {
		switch (char) {
			case 'x':
				return 'wall';
			case '!':
				return 'lava';
			default:
				return undefined;
					}
	}

	createGrid(strs) {
		let grid = [];
		for (let i = 0; i < strs.length; i++) {
			let aux = [];
			for (let j = 0; j < strs[i].length; j++) {
				aux.push(this.obstacleFromSymbol(strs[i].charAt(j)));
			}
			grid.push(aux);
		}
		return grid;
	}

	createActors(strs) {
		let actors = [];
		for (let i = 0; i < strs.length; i++) {
			for (let j = 0; j < strs[i].length; j++) {
				let actor = this.actorFromSymbol(strs[i].charAt(j));
				if (actor !== undefined && typeof actor === 'function') {
					let instance = new actor(new Vector(j, i));
					if (instance instanceof Actor) {
						actors.push(instance);
					}
				}
			}
		}
		return actors;
	}

	parse(strs) {
		return new Level(this.createGrid(strs), this.createActors(strs));
	}
}

class Fireball extends Actor {
	constructor(pos = new Vector(0, 0), speed = new Vector(0, 0)) {
		super(pos, new Vector(1, 1), speed);
	}

	get type() {
		return 'fireball';
	}

	getNextPosition(time = 1) {
		return this.pos.plus(this.speed.times(time));
	}

	handleObstacle() {
		this.speed = this.speed.times(-1);
	}

	act(time, level) {
		let nextPos = this.getNextPosition(time);
		if (level.obstacleAt(nextPos, this.size) !== undefined && level.obstacleAt(nextPos, this.size) !== false) {
			this.handleObstacle();
		} else this.pos = nextPos;
	}
}

class HorizontalFireball extends Fireball {
	constructor(pos) {
		super(pos, new Vector(2, 0));
	}
}

class VerticalFireball extends Fireball {
	constructor(pos) {
		super(pos, new Vector(0, 2));
	}
}

class FireRain extends Fireball {
	constructor(pos) {
		super(pos, new Vector(0, 3));
		this.initialPos = this.pos;
	}

	handleObstacle() {
		this.pos = this.initialPos;
	}
}

class Coin extends Actor {
	constructor(pos = new Vector(0, 0)) {
		super(pos.plus(new Vector(0.2, 0.1)), new Vector(0.6, 0.6));
		this.initialPos = this.pos;
		this.springSpeed = 8;
		this.springDist = 0.07;
		this.spring = Math.random() * Math.PI * 2;
	}

	get type() {
		return 'coin';
	}

	updateSpring(time = 1) {
		this.spring = this.spring + this.springSpeed * time;
	}

	getSpringVector() {
		return new Vector(0, Math.sin(this.spring) * this.springDist);
	}

	getNextPosition(time = 1) {
		this.spring += this.springSpeed * time;
		return this.initialPos.plus(this.getSpringVector());
	}

	act(time) {
		this.pos = this.getNextPosition(time);
	}
}

class Player extends Actor {

	constructor(pos = new Vector(0, 0)) {
		super(pos.plus(new Vector(0, -0.5)), new Vector(0.8, 1.5));
	}

	get type() {
		return 'player';
	}
}

const actorDict = {

	'@': Player,
	'v': FireRain,
	'o': Coin,
	'=': HorizontalFireball,
	'|': VerticalFireball

}

const parser = new LevelParser(actorDict);
loadLevels().then(json =>
				  runGame(JSON.parse(json), parser, DOMDisplay))
	.then(() => alert('Вы выиграли приз!'));

