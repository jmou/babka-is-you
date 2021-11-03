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
// INTERMISSION {{{

class World extends ECS {
  constructor() {
    super();
    this.listeners = {};
  }

  listen(type, listener) {
    (this.listeners[type] ||= []).push(listener);
  }

  signal(type, data) {
    for (const listener of this.listeners[type] || []) {
      listener(data);
    }
  }

  detach(entity, componentClass) {
    delete this.components[componentClass.name]?.[entity];
  }

  destroy(entity) {
    for (const c of Object.values(this.components)) {
      delete c[entity];
    }
  }

  queryComponent(componentClass) {
    const components = this.components[componentClass.name] || {};
    return Object.entries(components);
  }

  cast(entity, componentClass) {
    return this.components[componentClass.name]?.[entity];
  }
}

// INTERMISSION }}}
// ACT2SCENE1 {{{

class ComponentSprite {
  constructor(img, scale = 1) {
    this.canvas = document.createElement('canvas');
    this.canvas.width = img.width * scale;
    this.canvas.height = img.height * scale;
    const ctx = this.canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(img, 0, 0, this.canvas.width, this.canvas.height);
  }
}

class SystemSpriteRender {
  constructor(world, canvas) {
    this.world = world;
    this.ctx = canvas.getContext('2d');
    this.dirty = false;

    this.world.listen('recomposite', this.recomposite.bind(this));
    this.recomposite();
  }

  recomposite() {
    if (!this.dirty) {
      this.dirty = true;
      requestAnimationFrame(this.render.bind(this));
    }
  }

  render() {
    this.dirty = false;
    const { width, height } = this.ctx.canvas;
    this.ctx.clearRect(0, 0, width, height);
    this.world.signal('vblank', { width, height });

    for (const [entity, sprite] of this.world.queryComponent(ComponentSprite)) {
      const { x, y } = this.world.cast(entity, ComponentBounds);
      this.ctx.drawImage(sprite.canvas, x, y);
      this.world.signal('blit', entity);
    }

    this.world.signal('scanout');
  }
}

window.onload = function() {
  world = new World();
  const canvas = document.getElementById('game');
  const render = new SystemSpriteRender(world, canvas);

  let img = document.getElementById('flag');
  world.addEntity(
    new ComponentBounds(100, 100, 840, 800),
    new ComponentSprite(img, 40),
    new ComponentDrag(),
  );
};

// ACT2SCENE1 }}}
// POSTMATTER {{{

function rot13(s) {
  let r = [];
  for (const c of s) {
    r.push(c < 'a' ? c : String.fromCharCode((c.charCodeAt(0) - 97 + 13) % 26 + 97));
  }
  return r.join('');
}

function yourImage(src) {
  const img = document.createElement('img');
  img.src = src;
  img.addEventListener('load', () => {
    for (const entity in world.components.ComponentYou) {
      world.attach(entity, new ComponentSprite(img));
    }
    world.signal('recomposite');
  });
}

function babka() {
  for (const [entity, subject] of world.queryComponent(ComponentSubject)) {
    let standin;
    switch (subject.noun) {
      case 'baba': standin = 'babka'; break;
      case 'rock': standin = 'scone'; break;
      case 'wall': standin = 'tin'; break;
      case 'water': standin = 'cup'; break;
      case 'flag': standin = 'flour'; break;
    }
    const img = document.createElement('img');
    img.src = standin + '.png';
    img.addEventListener('load', () => {
      world.attach(entity, new ComponentSprite(img));
      world.signal('recomposite');
    });
  }
}

document.addEventListener('keydown', e => {
  if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey)
    return;
  switch (e.key) {
    case 'r': { loadLevel(false); break; }
    case 'w': { loadLevel(true); break; }
    case 's': { const x = alert; alert = console.log; loadLevel(true); alert = x; break; }
    case 'h': { document.body.classList.toggle('hit'); break; }
    case 'l': { document.body.classList.toggle('rules'); break; }
    case 'b': { yourImage('babka.png'); break; }
    case 'n': { loadLevel(false); babka(); break; }
  }
});

// set fdm=marker foldtext=v:folddashes.substitute(getline(v:foldstart),'//\ ','','')
// POSTMATTER }}}
