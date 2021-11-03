// CURTAIN {{{
// CURTAIN }}}
// ACT1SCENE1 {{{

class ECS {
  constructor() {
    this.maxEntity = 0;
    this.components = {};
  }

  addEntity(...components) {
    const entity = ++this.maxEntity;
    for (const c of components) {
      this.attach(entity, c);
    }
    return entity;
  }

  attach(entity, component) {
    (this.components[component.constructor.name] ||= {})[entity] = component;
  }
}

class ComponentBounds {
  constructor(x, y, width, height) {
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
  }
}

class ComponentWhiteBox {}

class SystemRender {
  constructor(world, canvas) {
    this.world = world;
    this.ctx = canvas.getContext('2d');
  }

  render() {
    const { width, height } = this.ctx.canvas;
    this.ctx.clearRect(0, 0, width, height);
    for (const entity in this.world.components.ComponentWhiteBox || []) {
      const { x, y, width, height } = this.world.components.ComponentBounds[entity];
      this.ctx.fillStyle = 'white';
      this.ctx.fillRect(x, y, width, height);
    }
  }
}

let world;

window.onload = function() {
  world = new ECS();
  const canvas = document.getElementById('game');
  const render = new SystemRender(world, canvas);
  world.addEntity(
    new ComponentBounds(100, 100, 80, 50),
    new ComponentWhiteBox(),
  );
  render.render();
};

// ACT1SCENE1 }}}
