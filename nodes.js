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
// ACT1SCENE2 {{{

class ComponentDrag {}

class SystemInput {
  constructor(world, canvas) {
    this.world = world;
    this.canvas = canvas;
    this.transition('default');
    canvas.addEventListener('mousedown', this.mousedown.bind(this));
    canvas.addEventListener('mousemove', this.mousemove.bind(this));
    canvas.addEventListener('mouseup', this.mouseup.bind(this));
  }

  transition(state, extra) {
    this.state = state;
    this.extra = extra;
  }

  localcoord(event) {
    const rect = event.target.getBoundingClientRect();
    // Does not account for padding;
    const x = event.x - rect.left;
    const y = event.y - rect.top;
    const scale = this.canvas.getBoundingClientRect().height / this.canvas.height;
    return { x: Math.floor(x / scale), y: Math.floor(y / scale) };
  }

  mousedown(event) {
    const { x, y } = this.localcoord(event);
    if (this.state == 'default') {
      if (!event.altKey && !event.ctrlKey && !event.metaKey && !event.shiftKey &&
          event.button == 0) {  // unmodified primary
        const entity = this.hit(x, y);
        this.transition('mousedown', { x, y, entity });
      }
    }
  }

  mousemove(event) {
    const { x, y } = this.localcoord(event);
    switch (this.state) {
      case 'mousedown': {  // drag
        this.transition('drag', {
          lastX: this.extra.x,
          lastY: this.extra.y,
          entity: this.extra.entity,
        });
      }  // fallthrough

      case 'drag': {
        if (!event.buttons) {  // stale mouse drag (outside of canvas)
          this.mouseup(event);
          break;
        }
        const dx = x - this.extra.lastX;
        const dy = y - this.extra.lastY;
        this.extra.lastX = x;
        this.extra.lastY = y;
        this.drag(dx, dy, this.extra.entity);
        break;
      }
    }
  }

  mouseup(event) {
    const { x, y } = this.localcoord(event);
    switch (this.state) {
      case 'mousedown': {
        this.click(x, y, this.extra.entity);
        break;
      }
      case 'drag': {
        this.transition('default');
        break;
      }
    }
  }

  click(x, y, entity) {
    this.world.addEntity(
      new ComponentBounds(x, y, 80, 50),
      new ComponentWhiteBox(),
      new ComponentDrag(),
    );
  }

  drag(dx, dy, entity) {
    if (entity in this.world.components.ComponentDrag) {
      const bounds = this.world.components.ComponentBounds[entity];
      bounds.x += dx;
      bounds.y += dy;
    }
  }

  hit(x, y) {
    for (const entity in this.world.components.ComponentDrag || []) {
      const bounds = this.world.components.ComponentBounds[entity];
      if (bounds && bounds.x < x && x < bounds.x + bounds.width &&
          bounds.y < y && y < bounds.y + bounds.height) {
        return entity;
      }
    }
  }
}

window.onload = function() {
  world = new ECS();
  const canvas = document.getElementById('game');
  const render = new SystemRender(world, canvas);

  new SystemInput(world, canvas);
  function tick() {
    render.render();
    requestAnimationFrame(tick);
  }
  tick();
};

// ACT1SCENE2 }}}
