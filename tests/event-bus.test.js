import { describe, it, expect } from 'vitest';
import { bus } from '../src/event-bus.js';

describe('EventBus', () => {
    it('should emit and receive events', () => {
        const results = [];
        bus.on('test:event', (data) => results.push(data));
        bus.emit('test:event', 'hello');
        expect(results).toEqual(['hello']);
    });

    it('should support multiple listeners', () => {
        const results = [];
        const unsub1 = bus.on('test:multi', (d) => results.push('a:' + d));
        bus.on('test:multi', (d) => results.push('b:' + d));
        bus.emit('test:multi', 'x');
        expect(results).toEqual(['a:x', 'b:x']);
        unsub1();
        results.length = 0;
        bus.emit('test:multi', 'y');
        expect(results).toEqual(['b:y']);
    });

    it('should handle once listeners', () => {
        const results = [];
        bus.once('test:once', (d) => results.push(d));
        bus.emit('test:once', 1);
        bus.emit('test:once', 2);
        expect(results).toEqual([1]);
    });

    it('should clear all listeners', () => {
        const results = [];
        bus.on('test:clear', (d) => results.push(d));
        bus.clear('test:clear');
        bus.emit('test:clear', 'x');
        expect(results).toEqual([]);
    });

    it('should not throw when no listeners', () => {
        expect(() => bus.emit('nonexistent', {})).not.toThrow();
    });
});
