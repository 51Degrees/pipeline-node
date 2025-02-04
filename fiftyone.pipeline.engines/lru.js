/* *********************************************************************
 * This Original Work is copyright of 51 Degrees Mobile Experts Limited.
 * Copyright 2025 51 Degrees Mobile Experts Limited, Davidson House,
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

class Node {
  constructor (key, value, next = null, prev = null) {
    this.key = key;
    this.value = value;
    this.next = next;
    this.prev = prev;
  }
}

class LRU {
  constructor (limit = 1000) {
    this.size = 0;
    this.limit = limit;
    this.head = null;
    this.tail = null;
    this.cache = {};
  }

  __convertKey (key) {
    if (((!!key) && (key.constructor === Array)) ||
      ((!!key) && (key.constructor === Object))) {
      return JSON.stringify(key);
    } else {
      return key;
    }
  }

  write (key, value) {
    this.ensureLimit();
    key = this.__convertKey(key);
    if (!this.head) {
      this.head = this.tail = new Node(key, value);
    } else {
      const node = new Node(key, value, this.head);
      this.head.prev = node;
      this.head = node;
    }

    this.cache[key] = this.head;
    this.size++;
  }

  read (key) {
    key = this.__convertKey(key);
    if (this.cache[key]) {
      const value = this.cache[key].value;

      this.remove(key);
      this.write(key, value);

      return value;
    } else {
      return null;
    }
  }

  ensureLimit () {
    if (this.size === this.limit) {
      this.remove(this.tail.key);
    }
  }

  remove (key) {
    key = this.__convertKey(key);
    const node = this.cache[key];

    if (node.prev !== null) {
      node.prev.next = node.next;
    } else {
      this.head = node.next;
    }

    if (node.next !== null) {
      node.next.prev = node.prev;
    } else {
      this.tail = node.prev;
    }

    delete this.cache[key];
    this.size--;
  }

  clear () {
    this.head = null;
    this.tail = null;
    this.size = 0;
    this.cache = {};
  }

  forEach (fn) {
    let node = this.head;
    let counter = 0;
    while (node) {
      fn(node, counter);
      node = node.next;
      counter++;
    }
  }

  * [Symbol.iterator] () {
    let node = this.head;
    while (node) {
      yield node;
      node = node.next;
    }
  }
}

module.exports = LRU;
