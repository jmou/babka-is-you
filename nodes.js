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
// ACT2SCENE2 {{{

class SystemHitInput extends SystemInput {
  constructor(world, canvas, hitcanvas) {
    super(world, canvas);
    this.hitcanvas = hitcanvas;
    world.listen('vblank', this.vblank.bind(this));
    world.listen('blit', this.blit.bind(this));
    world.listen('scanout', this.scanout.bind(this));
  }

  vblank({ width, height }) {
    this.hitcanvas.width = width;
    this.hitcanvas.height = height;
    this.hitctx = this.hitcanvas.getContext('2d', { alpha: false });
    this.hitctx.clearRect(0, 0, width, height);
    // Drawing must be pixel perfect (no antialiasing) for proper hit detection.
  }

  blit(entity) {
    const { x, y, width, height } = this.world.cast(entity, ComponentBounds);
    this.hitctx.fillStyle = this.swizzle(entity);
    this.hitctx.fillRect(Math.floor(x), Math.floor(y), Math.ceil(width), Math.ceil(height));
  }

  scanout() {
    this.hitmap = this.hitctx.getImageData(0, 0, this.hitcanvas.width, this.hitcanvas.height);
  }

  swizzle(entity) {
    // Encode up to 24 bits in RGB color. Multiply for visually distinct colors.
    const swizzled = (entity * 999331) % (1 << 24);
    return '#' + (swizzled).toString(16).padStart(6, 0);
  }

  hit(x, y) {
    const offset = (y * this.hitcanvas.width + x) * 4;
    let swizzled = 0;
    for (let i = 0; i < 3; i++ ) {
      swizzled <<= 8;
      swizzled += this.hitmap.data[offset + i];
    }
    if (!swizzled)
      return undefined;
    // Multiplicative inverse of swizzle() multiple.
    return (swizzled * 8055819) % (1 << 24)
  }

  click(x, y, entity) {
    if (entity) {
      alert('Clicked ' + entity);
    } else {
      const img = document.getElementById('flag');
      this.world.addEntity(
        new ComponentBounds(x, y, 63, 60),
        new ComponentSprite(img, 3),
        new ComponentDrag(),
      );
      world.signal('recomposite');
    }
  }
}

window.onload = function() {
  world = new World();
  const canvas = document.getElementById('game');
  const render = new SystemSpriteRender(world, canvas);
  new SystemHitInput(world, canvas, document.getElementById('hit'));
};

// ACT2SCENE2 }}}
// ACT3SCENE1 {{{

class ComponentYou {}
class ComponentPush {}
class ComponentStop {}
class ComponentSink {}
class ComponentWin {}

ComponentBounds.prototype.overlaps = function(o) {
  let dx;
  let dy;

  if (this.x <= o.x && o.x < this.x + this.width) {
    dx = this.x + this.width - o.x;
  }
  if (this.x <= o.x + o.width && o.x + o.width < this.x + this.width) {
    dx = dx ? 99 : this.x - o.x - o.width;
  }

  if (this.y <= o.y && o.y < this.y + this.height) {
    dy = this.y + this.height - o.y;
  }
  if (this.y <= o.y + o.height && o.y + o.height < this.y + this.height) {
    dy = dy ? 99 : this.y - o.y - o.height;
  }

  if (!dx || !dy) return null;
  if (Math.abs(dx) < Math.abs(dy)) {
    return [dx, 0];
  } else {
    return [0, dy];
  }
}

class SystemGameInput extends SystemHitInput {
  constructor(world, canvas, hitcanvas) {
    super(world, canvas, hitcanvas);
    this.won = false;
  }

  click(x, y, entity) { }

  drag(dx, dy, entity) {
    for (const [entity, ] of this.world.queryComponent(ComponentYou)) {
      const bounds = this.world.cast(entity, ComponentBounds);
      bounds.x += dx;
      bounds.y += dy;
      this.collide(entity);

      for (const [collision, ] of this.world.queryComponent(ComponentWin)) {
        if (this.world.cast(collision, ComponentBounds).overlaps(bounds)) {
          this.mouseup(event);
          this.world.signal('recomposite');
          if (this.won) return;  // hacky debounce
          this.won = true;
          this.world.signal('win');
          return;
        }
      }
    }
    this.world.signal('recomposite');
  }

  collide(entity) {
    const bounds = this.world.cast(entity, ComponentBounds);
    let adjust = [0, 0];

    for (const [collision, ] of this.world.queryComponent(ComponentSink)) {
      if (this.world.cast(collision, ComponentBounds).overlaps(bounds)) {
        this.world.destroy(entity);
        this.world.destroy(collision);
        return adjust;
      }
    }

    for (const [collision, ] of this.world.queryComponent(ComponentStop)) {
      const overlap = this.world.cast(collision, ComponentBounds).overlaps(bounds);
      if (overlap) {
        adjust[0] += overlap[0];
        adjust[1] += overlap[1];
      }
    }
    bounds.x += adjust[0];
    bounds.y += adjust[1];

    for (const [collision, ] of this.world.queryComponent(ComponentPush)) {
      if (collision == entity) continue;
      const pushed = this.world.cast(collision, ComponentBounds);
      const overlap = pushed.overlaps(bounds);
      if (overlap) {
        pushed.x -= overlap[0];
        pushed.y -= overlap[1];
        const resist = this.collide(collision);
        bounds.x += resist[0];
        bounds.y += resist[1];
        adjust[0] += resist[0];
        adjust[1] += resist[1];
      }
    }

    return adjust;
  }
}

function addSprite(r, c, asset, ...components) {
  const scale = 3;
  const x = c * 24 * scale;
  const y = r * 24 * scale;

  const img = document.getElementById(asset);
  const entity = world.addEntity(
    new ComponentBounds(x, y, scale * img.width, scale * img.height),
    new ComponentSprite(img, scale),
    ...components,
  );

  world.signal('recomposite');
  return entity;
}

window.onload = function() {
  const canvas = document.getElementById('game');
  world = new World();
  new SystemSpriteRender(world, canvas);
  new SystemGameInput(world, canvas, document.getElementById('hit'));

  addSprite(2, 5, 'rock', new ComponentPush());
  addSprite(2, 9, 'wall', new ComponentStop());
  addSprite(6, 5, 'water', new ComponentSink());
  addSprite(6, 9, 'flag', new ComponentWin());
  addSprite(4, 7, 'baba', new ComponentYou());

  world.listen('win', () => alert('you win!'));
};

// ACT3SCENE1 }}}
// ACT3SCENE2 {{{

class ComponentNoun {
  constructor(noun) {
    this.noun = noun;
  }
}

class ComponentIs {}

class ComponentVerb {
  constructor(componentClass) {
    this.componentClass = componentClass;
  }
}

class ComponentSubject {
  constructor(noun) {
    this.noun = noun;
  }
}

function addWord(r, c, asset, ...components) {
  return addSprite(r, c, asset, new ComponentPush(), ...components);
}

function addNoun(r, c, noun) {
  return addSprite(r, c, 'noun-' + noun,
                   new ComponentPush(),
                   new ComponentNoun(noun));
}

function addIs(r, c) {
  return addSprite(r, c, 'is',
                   new ComponentPush(),
                   new ComponentIs());
}

function addVerb(r, c, verb) {
  const capitalized = verb[0].toUpperCase() + verb.slice(1);
  return addSprite(r, c, 'verb-' + verb,
                   new ComponentPush(),
                   new ComponentVerb(eval('Component' + capitalized)));
}

function addSubject(r, c, noun) {
  return addSprite(r, c, noun, new ComponentSubject(noun));
}

class SystemBabaInput extends SystemGameInput {
  constructor(world, canvas, hitcanvas) {
    super(world, canvas, hitcanvas);
    this.rules = [];
    world.listen('scanout', this.attachDynamicComponents.bind(this));
  }

  attachDynamicComponents() {
    // Clear all rules
    for (const [entity, ] of this.world.queryComponent(ComponentSubject)) {
      this.world.detach(entity, ComponentYou);
      this.world.detach(entity, ComponentWin);
      this.world.detach(entity, ComponentStop);
      this.world.detach(entity, ComponentPush);
      this.world.detach(entity, ComponentSink);
    }
    this.rules = [];

    // Find active rules
    for (const [entity, ] of this.world.queryComponent(ComponentIs)) {
      const { x, y, width, height } = this.world.cast(entity, ComponentBounds);
      // 10px of slop (pushing can jitter a mousemove delta).
      for (const [[x1, y1], [x2, y2]] of [[[x-10, y + height/2], [x+width+9, y + height/2]],
                                          [[x + width/2, y-10], [x + width/2, y+height+9]]]) {
        const before = this.hit(x1, y1);
        const after = this.hit(x2, y2);
        const noun = this.world.cast(before, ComponentNoun);
        const verb = this.world.cast(after, ComponentVerb);
        if (noun && verb) {
          this.rules.push([noun.noun, verb.componentClass]);
        }
      }
    }

    // Attach components (verbs) to entities (nouns)
    let debugString = [];
    for (const [wordNoun, componentClass] of this.rules) {
      for (const [entity, { noun }] of this.world.queryComponent(ComponentSubject)) {
        if (wordNoun == noun) {
          this.world.attach(entity, new componentClass());
        }
      }
      debugString.push(`${wordNoun} attached to ${componentClass.name}`);
    }
    document.getElementById('rules').innerHTML = debugString.join('<br>');
  }
}

window.onload = function() {
  const canvas = document.getElementById('game');
  world = new World();
  new SystemSpriteRender(world, canvas);
  new SystemBabaInput(world, canvas, document.getElementById('hit'));

  addSubject(2, 5, 'rock');
  addSubject(2, 9, 'wall');
  addSubject(6, 5, 'water');
  addSubject(6, 9, 'flag');
  addSubject(4, 7, 'baba');

  addNoun(0, 0, 'baba');
  addIs(0, 1);
  addVerb(0, 2, 'you');

  addNoun(3, 0, 'rock');
  addIs(3, 1);
  addVerb(3, 2, 'push');

  addNoun(4, 0, 'wall');
  addIs(4, 1);
  addVerb(4, 2, 'stop');

  addNoun(5, 0, 'water');
  addIs(5, 1);
  addVerb(5, 2, 'sink');

  addNoun(6, 0, 'flag');
  addIs(6, 1);
  addVerb(6, 2, 'win');

  world.listen('win', () => alert('dynamical!'));
};

// ACT3SCENE2 }}}
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
