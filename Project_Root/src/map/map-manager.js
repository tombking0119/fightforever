import { gridToScreen, getRandomVariant } from '../core/iso-utils.js';

export class MapManager {
    constructor(container) {
        this.container = container;
        this.globalGrid = new Map(); 
        this.renderedTiles = new Map(); 
        this.renderedObjects = []; 
        this.chunkSize = 8; 
        this.loadedChunks = new Set();
        this.showDebug = false;
        
        this.animations = []; // 存储地形波浪动画

        this.propConfigs = [
            { prefix: 'prop_pillar', max: 3, folder: 'props' },
            { prefix: 'prop_tree', max: 3, folder: 'props' }
        ];
    }

    toggleDebug() {
        this.showDebug = !this.showDebug;
        for (const tile of this.renderedTiles.values()) {
            if (tile.debugGraphic) tile.debugGraphic.visible = this.showDebug;
        }
    }

    updateChunks(pX, pY) {
        const cX = Math.floor(pX / this.chunkSize);
        const cY = Math.floor(pY / this.chunkSize);
        const activeChunks = new Set();

        for (let x = cX - 1; x <= cX + 1; x++) {
            for (let y = cY - 1; y <= cY + 1; y++) {
                const key = `${x},${y}`;
                activeChunks.add(key);
                if (!this.loadedChunks.has(key)) {
                    this.loadChunk(x, y);
                    this.loadedChunks.add(key);
                }
            }
        }

        for (const key of this.loadedChunks) {
            if (!activeChunks.has(key)) {
                this.unloadChunk(key);
                this.loadedChunks.delete(key);
            }
        }
    }

    // 修复Bug的核心：将生成数据与渲染画面彻底分离
    loadChunk(cX, cY) {
        const sX = cX * this.chunkSize;
        const sY = cY * this.chunkSize;
        const chunkKey = `${cX},${cY}`;

        // 1. 如果该区域数据不存在，则生成全局数据
        const dataCheckKey = `${sX},${sY}`;
        if (!this.globalGrid.has(dataCheckKey)) {
            this.generateChunkData(sX, sY);
        }

        // 2. 根据 globalGrid 的确切数据进行渲染
        for (let x = sX; x < sX + this.chunkSize; x++) {
            for (let y = sY; y < sY + this.chunkSize; y++) {
                this.renderTile(x, y, chunkKey);
                
                const tileData = this.globalGrid.get(`${x},${y}`);
                if (tileData.hasObstacle) {
                    this.createObstacleVisual(x, y, chunkKey);
                } else if (tileData.propType) {
                    this.createPropVisual(x, y, tileData.propType, chunkKey);
                }
            }
        }
    }

    generateChunkData(sX, sY) {
        // 铺底
        for (let x = sX; x < sX + this.chunkSize; x++) {
            for (let y = sY; y < sY + this.chunkSize; y++) {
                this.globalGrid.set(`${x},${y}`, { type: 'grass', isPassable: true, hasObstacle: false, propType: null });
            }
        }

        this.applyStamp(sX, sY, 'loess', 2, 1.5);
        this.applyStamp(sX, sY, 'stone', 2, 2);
        this.applyStamp(sX, sY, 'magma', 1, 1);

        if (Math.random() < 0.5) this.applyMarbleStamp(sX, sY, 1);
        else this.applyMarbleStamp(sX, sY, 2);

        // 生成障碍物与装饰的数据
        for (let x = sX; x < sX + this.chunkSize; x++) {
            for (let y = sY; y < sY + this.chunkSize; y++) {
                const tileData = this.globalGrid.get(`${x},${y}`);
                if (Math.random() < 0.05 && tileData.type !== 'magma') {
                    tileData.isPassable = false; 
                    tileData.hasObstacle = true;
                }
            }
        }

        const propCount = 2 + Math.floor(Math.random() * 3);
        for (let i = 0; i < propCount; i++) {
            const rx = Math.floor(sX + Math.random() * this.chunkSize);
            const ry = Math.floor(sY + Math.random() * this.chunkSize);
            const tileData = this.globalGrid.get(`${rx},${ry}`);
            
            if (tileData && !tileData.hasObstacle && tileData.type !== 'magma') {
                let validConfigs = this.propConfigs;
                if (tileData.type === 'marble' || tileData.type === 'stone') {
                    validConfigs = this.propConfigs.filter(c => c.prefix !== 'prop_tree');
                }
                if (validConfigs.length > 0) {
                    const config = validConfigs[Math.floor(Math.random() * validConfigs.length)];
                    tileData.propType = `${config.prefix}_${getRandomVariant(config.max)}`;
                    tileData.isPassable = false; // 如果你想让装饰物也阻挡，取消注释这行并根据需求调整
                }
            }
        }
    }

    applyStamp(sX, sY, type, size, times) {
        for (let t = 0; t < times; t++) {
            const oX = sX + Math.floor(Math.random() * (this.chunkSize - size + 1));
            const oY = sY + Math.floor(Math.random() * (this.chunkSize - size + 1));
            for (let i = 0; i < size; i++) {
                for (let j = 0; j < size; j++) {
                    const key = `${oX + i},${oY + j}`;
                    const existing = this.globalGrid.get(key);
                    if (existing) existing.type = type;
                }
            }
        }
    }

    applyMarbleStamp(sX, sY, coreSize) {
        const totalSize = coreSize + 2; 
        const oX = sX + Math.floor(Math.random() * (this.chunkSize - totalSize + 1));
        const oY = sY + Math.floor(Math.random() * (this.chunkSize - totalSize + 1));
        
        for (let i = 0; i < totalSize; i++) {
            for (let j = 0; j < totalSize; j++) {
                const key = `${oX + i},${oY + j}`;
                const existing = this.globalGrid.get(key);
                if (!existing) continue;

                if (i === 0 || i === totalSize - 1 || j === 0 || j === totalSize - 1) {
                    if (existing.type !== 'marble') existing.type = 'stone';
                } else {
                    existing.type = 'marble';
                }
            }
        }
    }

    createObstacleVisual(gx, gy, chunkKey) {
        const pos = gridToScreen(gx, gy);
        const sprite = PIXI.Sprite.from(`obs_wall_01`);
        sprite.x = pos.x; sprite.y = pos.y + 64; 
        sprite.anchor.set(0.5, 1);
        sprite.zIndex = sprite.y;
        this.container.addChild(sprite);
        this.renderedObjects.push({ sprite, chunkKey, baseOffsetY: 64, isAnimatable: true, gridX: gx, gridY: gy });
    }

    createPropVisual(gx, gy, textureName, chunkKey) {
        const screenPos = gridToScreen(gx, gy);
        const sprite = PIXI.Sprite.from(textureName);
        sprite.x = screenPos.x; sprite.y = screenPos.y; 
        sprite.anchor.set(0.5, 1);
        sprite.zIndex = sprite.y;
        this.container.addChild(sprite);
        this.renderedObjects.push({ sprite, chunkKey, baseOffsetY: 0, isAnimatable: true, gridX: gx, gridY: gy });
    }

    renderTile(gx, gy, chunkKey) {
        const key = `${gx},${gy}`;
        const data = this.globalGrid.get(key);
        
        const variants = { 'grass': 5, 'loess': 3, 'stone': 9, 'marble': 7, 'magma': 4 };
        const textureName = `tile_${data.type}_${getRandomVariant(variants[data.type])}`;
        
        const sprite = PIXI.Sprite.from(textureName);
        const pos = gridToScreen(gx, gy);
        sprite.x = pos.x; sprite.y = pos.y;
        sprite.anchor.set(0.5, 64/152);
        sprite.zIndex = -10000 + pos.y;
        
        const g = new PIXI.Graphics();
        g.beginFill(data.isPassable ? 0x2ecc71 : 0xe74c3c, 0.4);
        g.moveTo(0, -64); g.lineTo(128, 0); g.lineTo(0, 64); g.lineTo(-128, 0);
        g.closePath(); g.endFill();
        g.visible = this.showDebug; 
        sprite.addChild(g); 

        this.container.addChild(sprite);
        // 记录原始位置信息供动画使用
        this.renderedTiles.set(key, { sprite, chunkKey, debugGraphic: g, baseX: pos.x, baseY: pos.y, gridX: gx, gridY: gy });
    }

    // --- 技能波浪系统 ---
    triggerWave(centerX, centerY) {
        const radius = 4;
        const waveHeight = 100;
        const duration = 500;

        // 对渲染出来的地块和上方的物体赋予动画参数
        const applyAnimation = (target, gridX, gridY, baseLogicalY, visualOffsetY = 0) => {
            const dist = Math.max(Math.abs(gridX - centerX), Math.abs(gridY - centerY)); // 切比雪夫距离 (方形扩散)
            if (dist > 0 && dist <= radius) {
                this.animations.push({
                    target: target,
                    baseLogicalY: baseLogicalY, // 未跳跃时的正常Y值
                    visualOffsetY: visualOffsetY, // 物体相比于基准点的修正（比如障碍物的 +64）
                    delay: dist * 100, // 距离越远，延迟越长
                    timer: 0,
                    duration: duration,
                    height: waveHeight
                });
            }
        };

        for (const tile of this.renderedTiles.values()) {
            applyAnimation(tile.sprite, tile.gridX, tile.gridY, tile.baseY, 0);
        }
        for (const obj of this.renderedObjects) {
            if (obj.isAnimatable) {
                const baseLogicalY = gridToScreen(obj.gridX, obj.gridY).y;
                applyAnimation(obj.sprite, obj.gridX, obj.gridY, baseLogicalY, obj.baseOffsetY);
            }
        }
    }

    update(deltaMS) {
        for (let i = this.animations.length - 1; i >= 0; i--) {
            const anim = this.animations[i];
            
            // 处理延迟
            if (anim.delay > 0) {
                anim.delay -= deltaMS;
                continue;
            }

            anim.timer += deltaMS;
            if (anim.timer >= anim.duration) {
                // 动画结束复位
                anim.target.y = anim.baseLogicalY + anim.visualOffsetY;
                this.animations.splice(i, 1);
            } else {
                // 播放抛物线位移
                const progress = anim.timer / anim.duration;
                const offset = Math.sin(progress * Math.PI) * anim.height;
                anim.target.y = (anim.baseLogicalY + anim.visualOffsetY) - offset;
            }
        }
    }

    unloadChunk(chunkKey) {
        for (const [key, tile] of this.renderedTiles.entries()) {
            if (tile.chunkKey === chunkKey) {
                this.container.removeChild(tile.sprite);
                tile.sprite.destroy({ children: true });
                this.renderedTiles.delete(key);
            }
        }
        for (let i = this.renderedObjects.length - 1; i >= 0; i--) {
            if (this.renderedObjects[i].chunkKey === chunkKey) {
                const obj = this.renderedObjects[i];
                this.container.removeChild(obj.sprite);
                obj.sprite.destroy();
                this.renderedObjects.splice(i, 1);
            }
        }
        // 清理绑定的失效动画
        this.animations = this.animations.filter(a => !a.target.destroyed);
    }

    getTileData(gx, gy) {
        return this.globalGrid.get(`${Math.floor(gx)},${Math.floor(gy)}`) || { isPassable: true };
    }
}