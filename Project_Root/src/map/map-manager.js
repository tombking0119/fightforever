// FILE: src/map/map-manager.js
import { gridToScreen, screenToGrid, getRandomVariant } from '../core/iso-utils.js';

export class MapManager {
    constructor(container) {
        this.container = container;
        this.globalGrid = new Map(); 
        this.renderedTiles = new Map(); 
        this.renderedObjects = []; 
        this.chunkSize = 8; // 基于规范：Chunk 8x8 动态加载 
        this.loadedChunks = new Set();
        this.showDebug = false;
        
        // 移除全局 debugLayer，改为绑定在具体图块上，解决内存泄漏
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
                    this.generateChunk(x, y);
                    this.loadedChunks.add(key);
                }
            }
        }

        // 视野外完美释放，防止分辨率穿帮
        for (const key of this.loadedChunks) {
            if (!activeChunks.has(key)) {
                this.unloadChunk(key);
                this.loadedChunks.delete(key);
            }
        }
    }

    // --- 核心：特征图章生成算法 ---
    generateChunk(cX, cY) {
        const sX = cX * this.chunkSize;
        const sY = cY * this.chunkSize;
        const chunkKey = `${cX},${cY}`;

        // 1. 打底：铺满 Grass (50% 基础)
        for (let x = sX; x < sX + this.chunkSize; x++) {
            for (let y = sY; y < sY + this.chunkSize; y++) {
                if (!this.globalGrid.has(`${x},${y}`)) {
                    this.globalGrid.set(`${x},${y}`, { type: 'grass', isPassable: true, hasObstacle: false });
                }
            }
        }

        // 2. 盖章：Loess 土块 (10%, 2x2方形) - 每个区块大约盖1~2次
        this.applyStamp(sX, sY, 'loess', 2, 1.5);

        // 3. 盖章：Stone 石块 (剩余的独立石块，2x2方形)
        this.applyStamp(sX, sY, 'stone', 2, 2);

        // 4. 盖章：Magma 岩浆 (2%, 单块独立)
        this.applyStamp(sX, sY, 'magma', 1, 1);

        // 5. 盖章：Marble 严格规则包围圈
        // 50%概率盖 1个大理石+8个石头(3x3)；50%概率盖 4个大理石+12个石头(4x4)
        if (Math.random() < 0.5) {
            this.applyMarbleStamp(sX, sY, 1); // 中心1x1
        } else {
            this.applyMarbleStamp(sX, sY, 2); // 中心2x2
        }

        // 渲染图块
        for (let x = sX; x < sX + this.chunkSize; x++) {
            for (let y = sY; y < sY + this.chunkSize; y++) {
                if (!this.renderedTiles.has(`${x},${y}`)) {
                    this.renderTile(x, y, chunkKey);
                }
            }
        }

        // 生成装饰与障碍
        this.spawnObjectsInChunk(sX, sY, chunkKey);
    }

    // 图章工具：在区块内随机位置盖下指定尺寸的连块
    applyStamp(sX, sY, type, size, times) {
        for (let t = 0; t < times; t++) {
            const oX = sX + Math.floor(Math.random() * (this.chunkSize - size + 1));
            const oY = sY + Math.floor(Math.random() * (this.chunkSize - size + 1));
            for (let i = 0; i < size; i++) {
                for (let j = 0; j < size; j++) {
                    const key = `${oX + i},${oY + j}`;
                    this.globalGrid.set(key, { type: type, isPassable: true, hasObstacle: false });
                }
            }
        }
    }

    // 大理石严格包围图章
    applyMarbleStamp(sX, sY, coreSize) {
        const totalSize = coreSize + 2; 
        const oX = sX + Math.floor(Math.random() * (this.chunkSize - totalSize + 1));
        const oY = sY + Math.floor(Math.random() * (this.chunkSize - totalSize + 1));
        
        for (let i = 0; i < totalSize; i++) {
            for (let j = 0; j < totalSize; j++) {
                const key = `${oX + i},${oY + j}`;
                // 边缘一圈强制为 Stone
                if (i === 0 || i === totalSize - 1 || j === 0 || j === totalSize - 1) {
                    const existing = this.globalGrid.get(key);
                    // 不覆盖已经存在的大理石，防止破坏相邻图案
                    if (!existing || existing.type !== 'marble') {
                        this.globalGrid.set(key, { type: 'stone', isPassable: true, hasObstacle: false });
                    }
                } else {
                    // 内部核心强制为 Marble
                    this.globalGrid.set(key, { type: 'marble', isPassable: true, hasObstacle: false });
                }
            }
        }
    }

    spawnObjectsInChunk(sX, sY, chunkKey) {
        for (let x = sX; x < sX + this.chunkSize; x++) {
            for (let y = sY; y < sY + this.chunkSize; y++) {
                const type = this.globalGrid.get(`${x},${y}`).type;
                // 障碍物 wall 生成（不在岩浆上生成）
                if (Math.random() < 0.05 && type !== 'magma') {
                    this.createObstacle(x, y, chunkKey);
                }
            }
        }

        const propCount = 2 + Math.floor(Math.random() * 3);
        for (let i = 0; i < propCount; i++) {
            const rx = sX + Math.random() * this.chunkSize;
            const ry = sY + Math.random() * this.chunkSize;
            this.createProp(rx, ry, chunkKey);
        }
    }

    createObstacle(gx, gy, chunkKey) {
        const tileData = this.globalGrid.get(`${gx},${gy}`);
        tileData.isPassable = false; 
        tileData.hasObstacle = true;

        // 同步更新该地块的调试网格颜色为红色
        const tileInfo = this.renderedTiles.get(`${gx},${gy}`);
        if (tileInfo && tileInfo.debugGraphic) {
            tileInfo.debugGraphic.clear();
            tileInfo.debugGraphic.beginFill(0xe74c3c, 0.4);
            tileInfo.debugGraphic.moveTo(0, -64); tileInfo.debugGraphic.lineTo(128, 0); 
            tileInfo.debugGraphic.lineTo(0, 64); tileInfo.debugGraphic.lineTo(-128, 0);
            tileInfo.debugGraphic.closePath(); tileInfo.debugGraphic.endFill();
        }

        const pos = gridToScreen(gx, gy);
        const sprite = PIXI.Sprite.from(`assets/images/obstacles/obs_wall_01.png`);
        sprite.x = pos.x; sprite.y = pos.y + 64; 
        sprite.anchor.set(0.5, 1);
        sprite.zIndex = sprite.y;
        
        this.container.addChild(sprite);
        this.renderedObjects.push({ sprite, chunkKey, type: 'obstacle' });
    }

    createProp(gx, gy, chunkKey) {
        const gridPos = `${Math.floor(gx)},${Math.floor(gy)}`;
        const tileData = this.globalGrid.get(gridPos);
        
        // 规则1：不能生成在 magma 内
        if (!tileData || tileData.type === 'magma') return; 

        // 规则2：过滤可用的装饰物
        let validConfigs = this.propConfigs;
        if (tileData.type === 'marble' || tileData.type === 'stone') {
            // tree 不能生成在 marble 和 stone 上
            validConfigs = this.propConfigs.filter(c => c.prefix !== 'prop_tree');
        }
        
        if (validConfigs.length === 0) return;

        const screenPos = gridToScreen(gx, gy);
        
        // 间隔至少40个像素
        const isOverlapping = this.renderedObjects.some(p => 
            Math.sqrt(Math.pow(p.sprite.x - screenPos.x, 2) + Math.pow(p.sprite.y - screenPos.y, 2)) < 40
        );
        if (isOverlapping) return;

        const config = validConfigs[Math.floor(Math.random() * validConfigs.length)];
        const textureName = `${config.prefix}_${getRandomVariant(config.max)}`;
        const sprite = PIXI.Sprite.from(`assets/images/${config.folder}/${textureName}.png`);
        
        sprite.x = screenPos.x; sprite.y = screenPos.y; 
        sprite.anchor.set(0.5, 1);
        sprite.zIndex = sprite.y;
        
        this.container.addChild(sprite);
        this.renderedObjects.push({ sprite, chunkKey, type: 'prop' });
    }

    renderTile(gx, gy, chunkKey) {
        const key = `${gx},${gy}`;
        const data = this.globalGrid.get(key);
        
        // 根据类型动态获取变体数量，极大简化外部配置
        const variants = { 'grass': 5, 'loess': 3, 'stone': 9, 'marble': 7, 'magma': 4 };
        const textureName = `tile_${data.type}_${getRandomVariant(variants[data.type])}`;
        
        const sprite = PIXI.Sprite.from(`assets/images/tiles/${textureName}.png`);
        const pos = gridToScreen(gx, gy);
        sprite.x = pos.x; sprite.y = pos.y;
        sprite.anchor.set(0.5, 64/152);
        sprite.zIndex = -10000 + sprite.y;
        
        // 修复内存泄漏：将调试网格绑定到对应的地面块上
        const g = new PIXI.Graphics();
        g.beginFill(data.isPassable ? 0x2ecc71 : 0xe74c3c, 0.4);
        g.moveTo(0, -64); g.lineTo(128, 0); g.lineTo(0, 64); g.lineTo(-128, 0);
        g.closePath(); g.endFill();
        g.visible = this.showDebug; // 初始状态根据全局开关决定
        sprite.addChild(g); 

        this.container.addChild(sprite);
        this.renderedTiles.set(key, { sprite, chunkKey, debugGraphic: g });
    }

    unloadChunk(chunkKey) {
        // 彻底释放图块及其绑定的调试网格
        for (const [key, tile] of this.renderedTiles.entries()) {
            if (tile.chunkKey === chunkKey) {
                this.container.removeChild(tile.sprite);
                tile.sprite.destroy({ children: true }); // 同步摧毁绑定的红绿网格
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
    }

    getTileData(gx, gy) {
        return this.globalGrid.get(`${Math.floor(gx)},${Math.floor(gy)}`) || { isPassable: true };
    }
}