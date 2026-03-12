import { MapManager } from './map/map-manager.js';
import { Player } from './entities/player.js';

const GAME_WIDTH = 1080; 
const GAME_HEIGHT = 1920;

async function init() {
    const app = new PIXI.Application();
    
    await app.init({ 
        width: GAME_WIDTH, 
        height: GAME_HEIGHT, 
        backgroundColor: 0x2c3e50, 
        resolution: window.devicePixelRatio || 1, 
        autoDensity: true 
    });

    const canvas = app.canvas || app.view;
    document.getElementById('game-container').appendChild(canvas);

    // --- 智能批量资源加载器 ---
    const manifest = [
        { alias: 'hero_idle', src: 'assets/images/hero/hero_idle.png' }
    ];
    
    const addAssets = (prefix, count, folder) => {
        for (let i = 1; i <= count; i++) {
            const num = i < 10 ? `0${i}` : `${i}`;
            manifest.push({ alias: `${prefix}_${num}`, src: `assets/images/${folder}/${prefix}_${num}.png` });
        }
    };

    // 根据你的资源规划动态生成加载列表
    addAssets('tile_grass', 5, 'tiles');
    addAssets('tile_loess', 3, 'tiles');
    addAssets('tile_magma', 4, 'tiles');
    addAssets('tile_marble', 7, 'tiles');
    addAssets('tile_stone', 9, 'tiles');
    addAssets('prop_pillar', 3, 'props');
    addAssets('prop_tree', 3, 'props');
    addAssets('obs_wall', 1, 'obstacles');

    try { 
        await PIXI.Assets.load(manifest); 
    } catch (e) { 
        console.error("图片加载失败，请检查 assets 目录结构及大小写", e);
    }

    function resize() {
        const scale = Math.min(window.innerWidth / GAME_WIDTH, window.innerHeight / GAME_HEIGHT);
        canvas.style.width = `${GAME_WIDTH * scale}px`; 
        canvas.style.height = `${GAME_HEIGHT * scale}px`;
    }
    window.addEventListener('resize', resize); 
    resize();

    const worldContainer = new PIXI.Container();
    worldContainer.sortableChildren = true; 
    app.stage.addChild(worldContainer);

    const mapManager = new MapManager(worldContainer);
    const player = new Player(worldContainer);

    // 初始生成周围的区块
    mapManager.updateChunks(0, 0);

    window.addEventListener('keydown', (e) => {
        if (e.code === 'KeyG') mapManager.toggleDebug();
    });

    app.ticker.add(() => {
        const playerGridPos = player.update(mapManager);
        // 动态加载新区块，释放旧区块
        mapManager.updateChunks(playerGridPos.x, playerGridPos.y);
        
        worldContainer.x = (GAME_WIDTH / 2) - player.sprite.x;
        worldContainer.y = (GAME_HEIGHT / 2) - player.sprite.y;
        worldContainer.children.sort((a, b) => a.zIndex - b.zIndex);
    });
}

init().catch(console.error);