// Spatial partitioning grid for collision optimization
// Divides the map into cells and only checks entities in nearby cells

import { CANVAS_WIDTH, CANVAS_HEIGHT } from './config.js';

const CELL_SIZE = 200;

export class SpatialGrid {
    constructor() {
        this.cols = Math.ceil(CANVAS_WIDTH / CELL_SIZE);
        this.rows = Math.ceil(CANVAS_HEIGHT / CELL_SIZE);
        this.cells = new Array(this.cols * this.rows);
        for (let i = 0; i < this.cells.length; i++) {
            this.cells[i] = [];
        }
    }

    clear() {
        for (let i = 0; i < this.cells.length; i++) {
            this.cells[i].length = 0;
        }
    }

    _cellKey(col, row) {
        if (col < 0 || col >= this.cols || row < 0 || row >= this.rows) return -1;
        return row * this.cols + col;
    }

    _addToCell(entity, col, row) {
        const key = this._cellKey(col, row);
        if (key >= 0) this.cells[key].push(entity);
    }

    insertPoint(entity, x, y) {
        const col = Math.floor(x / CELL_SIZE);
        const row = Math.floor(y / CELL_SIZE);
        this._addToCell(entity, col, row);
    }

    insertBox(entity, x, y, w, h) {
        const minCol = Math.floor(x / CELL_SIZE);
        const minRow = Math.floor(y / CELL_SIZE);
        const maxCol = Math.floor((x + w) / CELL_SIZE);
        const maxRow = Math.floor((y + h) / CELL_SIZE);
        for (let r = minRow; r <= maxRow; r++) {
            for (let c = minCol; c <= maxCol; c++) {
                this._addToCell(entity, c, r);
            }
        }
    }

    getNearby(x, y) {
        const results = [];
        const col = Math.floor(x / CELL_SIZE);
        const row = Math.floor(y / CELL_SIZE);
        for (let dr = -1; dr <= 1; dr++) {
            for (let dc = -1; dc <= 1; dc++) {
                const key = this._cellKey(col + dc, row + dr);
                if (key >= 0) {
                    const cell = this.cells[key];
                    for (let i = 0; i < cell.length; i++) {
                        results.push(cell[i]);
                    }
                }
            }
        }
        return results;
    }

    getNearbyRadius(x, y, radius) {
        const minCol = Math.floor((x - radius) / CELL_SIZE);
        const maxCol = Math.floor((x + radius) / CELL_SIZE);
        const minRow = Math.floor((y - radius) / CELL_SIZE);
        const maxRow = Math.floor((y + radius) / CELL_SIZE);
        const results = [];
        for (let dr = minRow; dr <= maxRow; dr++) {
            for (let dc = minCol; dc <= maxCol; dc++) {
                const key = this._cellKey(dc, dr);
                if (key >= 0) {
                    const cell = this.cells[key];
                    for (let i = 0; i < cell.length; i++) {
                        results.push(cell[i]);
                    }
                }
            }
        }
        return results;
    }

    static create() {
        return new SpatialGrid();
    }
}

export let grid = null;

export function rebuildGrid() {
    grid = new SpatialGrid();
}

export function getGrid() {
    return grid;
}
