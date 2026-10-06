import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Store, STORAGE_KEY, newPlanet } from '../js/state/store.js';
import { History, restoreSnapshot } from '../js/state/history.js';
import { CANON_PLANETS } from '../js/data/canonPlanets.js';

// A stand-in for window.localStorage.
function memoryStorage() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
    map,
  };
}

test('canon planets are listed without being saved', () => {
  const store = new Store(memoryStorage()).load();
  assert.equal(store.listPlanets().length, CANON_PLANETS.length);
  assert.equal(store.isModified('tatooine'), false);
});

test('edited and custom planets survive a save and reload', () => {
  const storage = memoryStorage();
  const store = new Store(storage).load();
  const tat = store.getPlanet('tatooine');
  tat.locations.push({ id: 'x', name: 'Secret Cave', type: 'cave', lat: 1.23456, lon: 2, secret: true });
  store.touch(tat);
  store.addPlanet(newPlanet({ name: 'Homebrew Prime', typeId: 'ice' }));
  assert.ok(store.saveNow());

  const again = new Store(storage).load();
  const tat2 = again.getPlanet('tatooine');
  assert.ok(again.isModified('tatooine'));
  const cave = tat2.locations.find((l) => l.id === 'x');
  assert.equal(cave.lat, 1.235, 'floats are rounded to 3 decimals');
  assert.equal(cave.secret, true);
  assert.ok(again.listPlanets().some((p) => p.name === 'Homebrew Prime'));
});

test('reset brings back the original canon planet', () => {
  const store = new Store(memoryStorage()).load();
  const tat = store.getPlanet('tatooine');
  tat.name = 'Not Tatooine';
  store.touch(tat);
  const fresh = store.resetPlanet('tatooine');
  assert.equal(fresh.name, 'Tatooine');
  assert.equal(store.isModified('tatooine'), false);
});

test('export and import round trip', () => {
  const a = new Store(memoryStorage()).load();
  const p = a.addPlanet(newPlanet({ name: 'Exported', typeId: 'desert' }));
  const file = JSON.parse(JSON.stringify(a.exportData([p])));
  const b = new Store(memoryStorage()).load();
  const res = b.importData(file);
  assert.deepEqual(res, { added: 1, replaced: 0, skipped: 0 });
  assert.equal(b.getPlanet(p.id).name, 'Exported');
  assert.throws(() => b.importData({ nothing: true }));
});

test('deleting a canon planet hides it until restored', () => {
  const store = new Store(memoryStorage()).load();
  store.deletePlanet('hoth');
  assert.ok(!store.listPlanets().some((p) => p.id === 'hoth'));
  store.restoreCanon();
  assert.ok(store.listPlanets().some((p) => p.id === 'hoth'));
});

test('a corrupted save does not crash loading', () => {
  const storage = memoryStorage();
  storage.setItem(STORAGE_KEY, '{not json');
  const errors = [];
  const store = new Store(storage, { onError: (m) => errors.push(m) }).load();
  assert.equal(errors.length, 1);
  assert.equal(store.listPlanets().length, CANON_PLANETS.length);
});

test('undo and redo restore planet snapshots', () => {
  const history = new History();
  const planet = { name: 'A', locations: [] };
  history.push(History.snapshot(planet));
  planet.name = 'B';
  planet.extra = true;
  const undoSnap = history.undo(History.snapshot(planet));
  restoreSnapshot(planet, undoSnap);
  assert.equal(planet.name, 'A');
  assert.equal('extra' in planet, false);
  const redoSnap = history.redo(History.snapshot(planet));
  restoreSnapshot(planet, redoSnap);
  assert.equal(planet.name, 'B');
});
