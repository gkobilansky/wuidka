import type { Spritesheet } from 'pixi.js';
import { PixiAssets, PixiGraphics, PixiSprite, PixiTexture } from '../../plugins/engine';
import { Manager } from '../../entities/manager';
import type { TierConfig } from '../../shared/config/game-config';

interface PieceSpriteOptions {
  targetDiameter?: number;
}

const tierFrameMap: Record<number, string[]> = {
  1: ['greedy-seedy', 'greedy-seedy-1'],
  2: ['drippy-drop', 'drippy-drop-1'],
  3: ['leafy-green', 'leafy-green-1'],
  4: ['funny-sunny', 'funny-sunny-1'],
  5: ['da-grind'],
  6: ['kief-kollection'],
  7: ['flahsy-hashy'],
  8: ['gold-diamond'],
  9: ['flaming-fire'],
  10: ['big-stoner']
};

const tierColors = [
  0xff0000, // Tier 1
  0xff8000, // Tier 2
  0xffff00, // Tier 3
  0x80ff00, // Tier 4
  0x00ff00, // Tier 5
  0x00ff80, // Tier 6
  0x00ffff, // Tier 7
  0x0080ff, // Tier 8
  0x0000ff, // Tier 9
  0x8000ff  // Tier 10
];

const textureCache: Map<number, PixiTexture> = new Map();
const fallbackTextureCache: Map<string, PixiTexture> = new Map();
let cachedSpritesheet: Spritesheet | null = null;

export function createPieceSprite(tier: TierConfig, options: PieceSpriteOptions = {}): PixiSprite {
  const targetDiameter = options.targetDiameter ?? tier.radius * 2;
  const texture = getTierTexture(tier.id);

  if (texture) {
    const sprite = new PixiSprite(texture);
    sprite.anchor.set(0.5);
    const baseWidth = getTextureBaseWidth(texture);
    if (baseWidth > 0) {
      const scale = targetDiameter / baseWidth;
      sprite.scale.set(scale);
    }
    return sprite;
  }

  return createFallbackSprite(tier.id, targetDiameter / 2);
}

function getTierTexture(tierId: number): PixiTexture | undefined {
  const cached = textureCache.get(tierId);
  if (cached) {
    return cached;
  }

  const frameNames = tierFrameMap[tierId];
  if (!frameNames) {
    return undefined;
  }

  const spritesheet = getSpritesheet();
  if (!spritesheet) {
    return undefined;
  }

  for (const frame of frameNames) {
    const texture = spritesheet.textures?.[frame];
    if (texture) {
      textureCache.set(tierId, texture);
      return texture;
    }
  }

  return undefined;
}

function getSpritesheet(): Spritesheet | null {
  if (cachedSpritesheet) {
    return cachedSpritesheet;
  }

  const sheet = PixiAssets.get('pieces-atlas-data') as Spritesheet | undefined;
  if (sheet && typeof sheet === 'object' && sheet.textures) {
    cachedSpritesheet = sheet;
    return sheet;
  }

  return null;
}

function getTextureBaseWidth(texture: PixiTexture): number {
  // Prefer original size when available to avoid scale skew from previous adjustments
  const origWidth = (texture as any).orig?.width;
  if (typeof origWidth === 'number' && origWidth > 0) {
    return origWidth;
  }
  return texture.width;
}

function createFallbackSprite(tierId: number, radius: number): PixiSprite {
  const key = `${tierId}:${radius.toFixed(2)}`;
  let texture = fallbackTextureCache.get(key);

  if (!texture) {
    const graphics = new PixiGraphics();
    graphics.circle(0, 0, radius);
    graphics.fill(getTierColor(tierId));

    const renderer = Manager.app?.renderer;
    if (!renderer) {
      throw new Error('Pixi renderer not initialized');
    }

    texture = renderer.generateTexture(graphics) as PixiTexture;
    fallbackTextureCache.set(key, texture);
  }

  const sprite = new PixiSprite(texture);
  sprite.anchor.set(0.5);
  return sprite;
}

function getTierColor(tierId: number): number {
  const index = (tierId - 1) % tierColors.length;
  return tierColors[index];
}
