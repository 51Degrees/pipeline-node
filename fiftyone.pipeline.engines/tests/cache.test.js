/* *********************************************************************
 * This Original Work is copyright of 51 Degrees Mobile Experts Limited.
 * Copyright 2023 51 Degrees Mobile Experts Limited, Davidson House,
 * Forbury Square, Reading, Berkshire, United Kingdom RG1 3EU.
 *
 * This Original Work is licensed under the European Union Public Licence
 * (EUPL) v.1.2 and is subject to its terms as set out below.
 *
 * If a copy of the EUPL was not distributed with this file, You can obtain
 * one at https://opensource.org/licenses/EUPL-1.2.
 *
 * The 'Compatible Licences' set out in the Appendix to the EUPL (as may be
 * amended by the European Commission) shall be deemed incompatible for
 * the purposes of the Work and the provisions of the compatibility
 * clause in Article 5 of the EUPL shall not apply.
 *
 * If using the Work as, or as part of, a network application, by
 * including the attribution notice(s) required under Article 5 of the EUPL
 * in the end user terms of the application under an appropriate heading,
 * such notice(s) shall fulfill the requirements of that article.
 * ********************************************************************* */
const path = require('path');

const LruCache = require(path.resolve(__dirname, '..', 'lruCache'));

/**
 * Check that an entry keyed on a simple string can be added
 * and fetched.
 */
test('cache - string key - get', () => {
  const cache = new LruCache({});
  const key = 'one';
  const value = 'value one';
  cache.put(key, value);
  expect(cache.get(key)).toBe(value);
});

/**
 * Check that an entry keyed on a complex object can be added
 * and fetched.
 */
test('cache - complex key - get', () => {
  const cache = new LruCache({});
  const key = { key: 'one' };
  const value = 'value one';
  cache.put(key, value);
  expect(cache.get(key)).toBe(value);
});

/**
 * Check that null is returned if a simple string key is not
 * present.
 */
test('cache - string key - get not present', () => {
  const cache = new LruCache({});
  const key = 'one';
  const otherKey = 'two';
  const value = 'value one';
  cache.put(key, value);
  expect(cache.get(otherKey)).toBe(null);
});

/**
 * Check that null is returned if a complex object key is not
 * present.
 */
test('cache - complex key - get not present', () => {
  const cache = new LruCache({});
  const key = { key: 'one' };
  const otherKey = { key: 'two' };
  const value = 'value one';
  cache.put(key, value);
  expect(cache.get(otherKey)).toBe(null);
});

/**
 * Check that the oldest entry is evicted correctly when using
 * simple string keys.
 */
test('cache - string key - evicted', () => {
  const cache = new LruCache({ size: 2 });
  cache.put('one', 'one');
  cache.put('two', 'two');
  cache.put('three', 'three');
  expect(cache.get('three')).toBe('three');
  expect(cache.get('two')).toBe('two');
  expect(cache.get('one')).toBe(null);
});

/**
 * Check that the oldest entry is evicted correctly when using
 * complex object keys.
 */
test('cache - complex key - evicted', () => {
  const cache = new LruCache({ size: 2 });
  cache.put({ key: 'one' }, 'one');
  cache.put({ key: 'two' }, 'two');
  cache.put({ key: 'three' }, 'three');
  expect(cache.get({ key: 'three' })).toBe('three');
  expect(cache.get({ key: 'two' })).toBe('two');
  expect(cache.get({ key: 'one' })).toBe(null);
});

/**
 * Check that the value is replaced for an existing simple string
 * key.
 */
test('cache - string key - update', () => {
  const cache = new LruCache({});
  cache.put('one', 'one');
  cache.put('one', 'two');
  expect(cache.get('one')).toBe('two');
});

/**
 * Check that the value is replaced for an existing complex object
 * key.
 */
test('cache - complex key - update', () => {
  const cache = new LruCache({ size: 2 });
  cache.put({ key: 'one' }, 'one');
  cache.put({ key: 'one' }, 'two');
  expect(cache.get({ key: 'one' })).toBe('two');
});
