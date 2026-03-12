import { MapManager } from './map/map-manager.js';
import { Player } from './entities/player.js';

const GAME_WIDTH = 1080; 
const GAME_HEIGHT = 1920;

async function init() {
    const app = new PIXI.Application();
    await app.init({ 
        width: GAME_WIDTH, height: GAME_HEIGHT, 
        backgroundColor: 0x2c3e50, resolution: window.devicePixelRatio || 1, autoDensity: true 
    });

    document.getElementById('game-container').appendChild(app.canvas);

    const manifest = [{ alias: 'hero_idle', src: 'assets/images/hero/hero_idle.png' }];
    const addAssets = (prefix, count, folder) => {
        for (let i = 1; i <= count; i++) {
            const num = i < 10 ? `0${i}` : `${i}`;
            manifest.push({ alias: `${prefix}_${num}`, src: `assets/images/${folder}/${prefix}_${num}.png` });
        }
    };

    addAssets('tile_grass', 5, 'tiles');
    addAssets('tile_loess', 3, 'tiles');
    addAssets('tile_magma', 4, 'tiles');
    addAssets('tile_marble', 7, 'tiles');
    addAssets('tile_stone', 9, 'tiles');
    addAssets('prop_pillar', 3, 'props');
    addAssets('prop_tree', 3, 'props');
    addAssets('obs_wall', 1, 'obstacles');

    await PIXI.Assets.load(manifest);

    function resize() {
        const scale = Math.min(window.innerWidth / GAME_WIDTH, window.innerHeight / GAME_HEIGHT);
        app.canvas.style.width = `${GAME_WIDTH * scale}px`; 
        app.canvas.style.height = `${GAME_HEIGHT * scale}px`;
    }
    window.addEventListener('resize', resize); resize();

    const worldContainer = new PIXI.Container();
    worldContainer.sortableChildren = true; 
    app.stage.addChild(worldContainer);

    const mapManager = new MapManager(worldContainer);
    const player = new Player(worldContainer);

    mapManager.updateChunks(0, 0);

    window.addEventListener('keydown', (e) => {
        if (e.code === 'KeyG') mapManager.toggleDebug();
    });

    app.ticker.add((ticker) => {
        // 传递 ticker.deltaMS 用于动画计时
        const playerGridPos = player.update(mapManager, ticker.deltaMS);
        mapManager.update(ticker.deltaMS);
        mapManager.updateChunks(playerGridPos.x, playerGridPos.y);
        
        worldContainer.x = (GAME_WIDTH / 2) - player.sprite.x;
        worldContainer.y = (GAME_HEIGHT / 2) - player.sprite.y;
        worldContainer.children.sort((a, b) => a.zIndex - b.zIndex);
    });
}
init().catch(console.error);