import type { Spritesheet } from 'pixi.js';
import { PixiAssets, PixiGraphics, PixiSprite, PixiTexture } from '../../plugins/engine';
import { Manager } from '../../entities/manager';
import type { TierConfig } from '../../shared/config/game-config';

interface PieceSpriteOptions {
  targetDiameter?: number;
}

const textureCache: Map<number, PixiTexture> = new Map();
const fallbackTextureCache: Map<string, PixiTexture> = new Map();
let cachedSpritesheet: Spritesheet | null = null;

export function createPieceSprite(tier: TierConfig, options: PieceSpriteOptions = {}): PixiSprite {
  const targetDiameter = options.targetDiameter ?? tier.radius * 2;
  const texture = getTierTexture(tier);

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

  return createFallbackSprite(tier, targetDiameter / 2);
}

function getTierTexture(tier: TierConfig): PixiTexture | undefined {
  const cached = textureCache.get(tier.id);
  if (cached) {
    return cached;
  }

  const frameNames = tier.frames;
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
      textureCache.set(tier.id, texture);
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

function createFallbackSprite(tier: TierConfig, radius: number): PixiSprite {
  const key = `${tier.id}:${radius.toFixed(2)}`;
  let texture = fallbackTextureCache.get(key);

  if (!texture) {
    const graphics = new PixiGraphics();
    graphics.circle(0, 0, radius);
    graphics.fill(tier.color);

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
