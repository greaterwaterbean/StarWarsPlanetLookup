import { test } from 'node:test';
import assert from 'node:assert/strict';
import { crc32, makeZip } from '../js/state/zip.js';
import { foundryScene, foundryJournal, NOTE_ICONS, FLAG_SCOPE } from '../js/foundry.js';
import { flatPosition } from '../js/render/flatMap.js';
import { LOCATION_TYPES } from '../js/data/locationTypes.js';
import { canonDefault } from '../js/state/store.js';

test('crc32 matches the standard check value', () => {
  assert.equal(crc32(new TextEncoder().encode('123456789')), 0xcbf43926);
});

test('zip files have valid headers, directory and checksums', () => {
  const files = [
    { name: 'a.txt', data: 'hello' },
    { name: 'folder/b.bin', data: new Uint8Array([1, 2, 3, 250]) },
  ];
  const zip = makeZip(files, new Date(2026, 9, 6, 12, 0, 0));
  const view = new DataView(zip.buffer);
  const endAt = zip.length - 22;
  assert.equal(view.getUint32(endAt, true), 0x06054b50);
  assert.equal(view.getUint16(endAt + 10, true), 2);
  let p = view.getUint32(endAt + 16, true);
  const decoder = new TextDecoder();
  for (const f of files) {
    assert.equal(view.getUint32(p, true), 0x02014b50);
    const size = view.getUint32(p + 20, true);
    const nameLen = view.getUint16(p + 28, true);
    const local = view.getUint32(p + 42, true);
    const name = decoder.decode(zip.subarray(p + 46, p + 46 + nameLen));
    assert.equal(name, f.name);
    assert.equal(view.getUint32(local, true), 0x04034b50);
    const localNameLen = view.getUint16(local + 26, true);
    const data = zip.subarray(local + 30 + localNameLen, local + 30 + localNameLen + size);
    const expected = typeof f.data === 'string' ? new TextEncoder().encode(f.data) : f.data;
    assert.deepEqual(Array.from(data), Array.from(expected));
    assert.equal(view.getUint32(p + 16, true), crc32(expected));
    p += 46 + nameLen;
  }
});

test('flat map positions put lat/lon on an equirectangular grid', () => {
  assert.deepEqual(flatPosition(0, 0, 4096, 2048), { x: 2048, y: 1024 });
  assert.deepEqual(flatPosition(90, -180, 4096, 2048), { x: 0, y: 0 });
  assert.deepEqual(flatPosition(-90, 180, 4096, 2048), { x: 4096, y: 2048 });
});

test('every place type has a Foundry note icon', () => {
  for (const t of LOCATION_TYPES) assert.ok(NOTE_ICONS[t.id], t.id);
});

test('Foundry scene marks places as notes and leaves secrets out by default', () => {
  const planet = canonDefault('sakifwanna');
  const secret = planet.locations.filter((l) => l.secret).length;
  assert.ok(secret > 0, 'test needs a planet with a secret place');
  const scene = foundryScene(planet, { width: 4096, height: 2048, imagePath: 'planet-lookup/sakifwanna-map.png', planetData: { id: planet.id } });
  assert.equal(scene.notes.length, planet.locations.length - secret);
  assert.equal(scene.background.src, 'planet-lookup/sakifwanna-map.png');
  assert.equal(scene.padding, 0, 'no padding, so note coordinates match the image');
  assert.equal(scene.grid.units, 'km');
  assert.equal(scene.grid.distance, Math.round(((Math.PI * planet.diameter) / 4096) * 100));
  const sak = planet.locations.find((l) => l.name === 'Sak');
  const note = scene.notes.find((n) => n.text === 'Sak');
  const pos = flatPosition(sak.lat, sak.lon, 4096, 2048);
  assert.equal(note.x, Math.round(pos.x));
  assert.equal(note.y, Math.round(pos.y));
  assert.equal(scene.flags[FLAG_SCOPE].planet.id, planet.id);
  const withSecret = foundryScene(planet, { width: 4096, height: 2048, imagePath: 'x.png', includeSecret: true });
  assert.equal(withSecret.notes.length, planet.locations.length);
});

test('Foundry journal has an overview plus a page per place, GM notes only on request', () => {
  const planet = canonDefault('sakifwanna');
  const plain = foundryJournal(planet);
  assert.equal(plain.pages[0].name, 'Overview');
  assert.equal(plain.pages.length, 1 + planet.locations.filter((l) => !l.secret).length);
  assert.ok(!JSON.stringify(plain).includes('GM notes'));
  const gm = foundryJournal(planet, { includeGmNotes: true, globeUrl: 'https://example.com/#planet=sakifwanna', embedGlobe: true });
  assert.ok(JSON.stringify(gm).includes('GM notes'));
  assert.ok(gm.pages[0].text.content.includes('<iframe'));
  // HTML in user text is escaped.
  const tricky = { ...planet, description: '<script>x</script>', locations: [] };
  assert.ok(!foundryJournal(tricky).pages[0].text.content.includes('<script>'));
});
