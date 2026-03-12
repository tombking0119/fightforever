# 2D Isometric Roguelike Project (v2.1)

## 开发环境
- 逻辑分辨率: 1080 * 1920
- 运行环境: 本地服务器 (Live Server)
- 依赖库: PixiJS v8 CDN

## 资源命名规范
- 地面 (Tiles): `tile_[type]_[01-09].png` (grass, loess, stone, marble, magma)
- 装饰 (Props): `prop_[type]_[01-03].png` (pillar, tree)
- 障碍 (Obs): `obs_wall_01.png`
- 主角 (Hero): `hero_idle.png`

## 数学转换公式
- Cartesian to Iso: 
  x = (gridX - gridY) * 128
  y = (gridX + gridY) * 64
- 逆向公式已集成于 `iso-utils.js`，用于碰撞检测。