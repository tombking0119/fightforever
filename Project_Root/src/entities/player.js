import { screenToGrid } from '../core/iso-utils.js';

export class Player {
    constructor(container) {
        this.container = container;
        this.sprite = PIXI.Sprite.from('assets/images/hero/hero_idle.png');
        this.sprite.anchor.set(0.5, 1);
        this.sprite.x = 0; 
        this.sprite.y = 0;
        this.speed = 6; 
        this.container.addChild(this.sprite);

        this.keys = {};
        window.addEventListener('keydown', e => this.keys[e.code] = true);
        window.addEventListener('keyup', e => this.keys[e.code] = false);
    }

    update(mapManager) {
        let dx = 0;
        let dy = 0;
        if (this.keys['KeyW']) dy -= 1;
        if (this.keys['KeyS']) dy += 1;
        if (this.keys['KeyA']) dx -= 1;
        if (this.keys['KeyD']) dx += 1;

        if (dx !== 0 || dy !== 0) {
            // 角色镜像翻转逻辑：向左走(A)时镜像
            if (dx < 0) this.sprite.scale.x = -1;
            else if (dx > 0) this.sprite.scale.x = 1;

            const length = Math.sqrt(dx * dx + dy * dy);
            const nextX = this.sprite.x + (dx / length) * this.speed;
            const nextY = this.sprite.y + (dy / length) * this.speed;

            // 碰撞检测
            const gridPos = screenToGrid(nextX, nextY);
            if (mapManager.getTileData(gridPos.x, gridPos.y).isPassable) {
                this.sprite.x = nextX;
                this.sprite.y = nextY;
            }
        }
        this.sprite.zIndex = this.sprite.y;
        return screenToGrid(this.sprite.x, this.sprite.y);
    }
}