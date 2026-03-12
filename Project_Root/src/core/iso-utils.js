// 基于你的美术规范：瓦片宽度256，逻辑菱形高度128（152减去24的厚度）
export const TILE_W = 256;
export const TILE_H = 128; 

// 网格坐标 转 屏幕坐标
export function gridToScreen(gridX, gridY) {
    return {
        x: (gridX - gridY) * (TILE_W / 2),
        y: (gridX + gridY) * (TILE_H / 2)
    };
}

// 屏幕坐标 转 网格坐标 (逆矩阵，用于碰撞检测)
export function screenToGrid(screenX, screenY) {
    return {
        x: (screenX / (TILE_W / 2) + screenY / (TILE_H / 2)) / 2,
        y: (screenY / (TILE_H / 2) - screenX / (TILE_W / 2)) / 2
    };
}

// 辅助函数：获取随机变体后缀 (比如 01, 02)
export function getRandomVariant(max) {
    const num = Math.floor(Math.random() * max) + 1;
    return num < 10 ? `0${num}` : `${num}`;
}