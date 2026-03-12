import { screenToGrid } from '../core/iso-utils.js';

export class Player {
    constructor(container) {
        this.container = container;
        this.sprite = PIXI.Sprite.from('hero_idle'); // 使用预加载的 alias
        this.sprite.anchor.set(0.5, 1);
        this.sprite.x = 0; this.sprite.y = 0;
        this.baseY = 0; // 记录角色逻辑站在地面的Y值
        this.speed = 6; 
        this.container.addChild(this.sprite);

        // 状态与控制
        this.keys = {};
        this.joyDelta = { x: 0, y: 0 };
        this.isJumping = false;
        this.jumpTimer = 0;
        this.jumpDuration = 500; // 0.5秒
        this.jumpHeight = 50;
        
        this.setupInputs();
    }

    setupInputs() {
        // PC 键盘
        window.addEventListener('keydown', e => {
            this.keys[e.code] = true;
            if (e.code === 'Space') this.triggerJump();
        });
        window.addEventListener('keyup', e => this.keys[e.code] = false);

        // 移动端摇杆 & 双指触控
        const zone = document.getElementById('joystick-zone');
        const knob = document.getElementById('joystick-knob');
        let joyId = null;

        document.addEventListener('touchstart', e => {
            if (e.touches.length >= 2) this.triggerJump();
        });

        zone.addEventListener('pointerdown', e => {
            joyId = e.pointerId;
            this.updateJoy(e, zone, knob);
        });
        window.addEventListener('pointermove', e => {
            if (e.pointerId === joyId) this.updateJoy(e, zone, knob);
        });
        window.addEventListener('pointerup', e => {
            if (e.pointerId === joyId) {
                joyId = null;
                knob.style.transform = `translate(-50%, -50%)`;
                this.joyDelta = { x: 0, y: 0 };
            }
        });
    }

    updateJoy(e, zone, knob) {
        const rect = zone.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        let dx = e.clientX - centerX;
        let dy = e.clientY - centerY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const maxDist = rect.width / 2;

        if (dist > maxDist) {
            dx = (dx / dist) * maxDist;
            dy = (dy / dist) * maxDist;
        }
        knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
        // 归一化输入
        this.joyDelta = { x: dx / maxDist, y: dy / maxDist };
    }

    triggerJump() {
        if (!this.isJumping) {
            this.isJumping = true;
            this.jumpTimer = 0;
            // 触发时刻通知，MapManager 会接管后续的波动处理
            this.pendingWave = true; 
        }
    }

    update(mapManager, deltaMS) {
        // 1. 移动逻辑 (仅在不跳跃时允许位移)
        if (!this.isJumping) {
            let dx = this.joyDelta.x;
            let dy = this.joyDelta.y;
            
            if (this.keys['KeyW']) dy -= 1;
            if (this.keys['KeyS']) dy += 1;
            if (this.keys['KeyA']) dx -= 1;
            if (this.keys['KeyD']) dx += 1;

            if (dx !== 0 || dy !== 0) {
                if (dx < 0) this.sprite.scale.x = -1;
                else if (dx > 0) this.sprite.scale.x = 1;

                const length = Math.sqrt(dx * dx + dy * dy);
                const nextX = this.sprite.x + (dx / length) * this.speed;
                const nextY = this.baseY + (dy / length) * this.speed;

                const gridPos = screenToGrid(nextX, nextY);
                if (mapManager.getTileData(gridPos.x, gridPos.y).isPassable) {
                    this.sprite.x = nextX;
                    this.baseY = nextY;
                }
            }
        }

        // 2. 跳跃动画逻辑
        if (this.isJumping) {
            this.jumpTimer += deltaMS;
            if (this.jumpTimer >= this.jumpDuration) {
                this.isJumping = false;
                this.sprite.y = this.baseY; // 落地
                
                // 落地瞬间触发震荡波
                if (this.pendingWave) {
                    const gridPos = screenToGrid(this.sprite.x, this.baseY);
                    mapManager.triggerWave(Math.floor(gridPos.x), Math.floor(gridPos.y));
                    this.pendingWave = false;
                }
            } else {
                // 正弦波抛物线
                const progress = this.jumpTimer / this.jumpDuration;
                const yOffset = Math.sin(progress * Math.PI) * this.jumpHeight;
                this.sprite.y = this.baseY - yOffset;
            }
        } else {
            this.sprite.y = this.baseY;
        }

        this.sprite.zIndex = this.baseY; // 排序基准始终为脚底
        return screenToGrid(this.sprite.x, this.baseY);
    }
}