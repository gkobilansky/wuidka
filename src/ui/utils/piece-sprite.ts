import type { Spritesheet } from 'pixi.js';
import { PixiAssets, PixiGraphics, PixiSprite, PixiTexture } from '../../plugins/engine';
import { Manager } from '../../entities/manager';
import type { TierConfig } from '../../shared/config/game-config';

interface PieceSpriteOptions {
  targetDiameter?: number;
}

type PieceSpriteWithFrames = PixiSprite & {
  pieceFrameTextures?: PixiTexture[];
  pieceFrameIndex?: number;
  pieceActiveFrameIndex?: number;
  pieceTargetDiameter?: number;
};

const tierTextureCache: Map<number, PixiTexture[]> = new Map();
const frameTextureCache: Map<string, PixiTexture> = new Map();
const fallbackTextureCache: Map<string, PixiTexture> = new Map();
let cachedSpritesheet: Spritesheet | null = null;

export function createPieceSprite(tier: TierConfig, options: PieceSpriteOptions = {}): PixiSprite {
  const targetDiameter = options.targetDiameter ?? tier.radius * 2;
  const textures = getTierTextures(tier);

  if (textures.length > 0) {
    const sprite = new PixiSprite(textures[0]);
    sprite.anchor.set(0.5);

    const spriteWithFrames = sprite as PieceSpriteWithFrames;
    spriteWithFrames.pieceFrameTextures = textures;
    spriteWithFrames.pieceTargetDiameter = targetDiameter;
    spriteWithFrames.pieceActiveFrameIndex = findActiveFrameIndex(tier.frames);

    setSpriteFrameIndex(spriteWithFrames, 0);
    return sprite;
  }

  return createFallbackSprite(tier, targetDiameter / 2);
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

function getTierTextures(tier: TierConfig): PixiTexture[] {
  const cached = tierTextureCache.get(tier.id);
  if (cached) {
    return cached;
  }

  const textures: PixiTexture[] = [];
  for (const frameName of tier.frames ?? []) {
    const texture = getFrameTexture(frameName);
    if (texture) {
      textures.push(texture);
    }
  }

  if (textures.length > 0) {
    tierTextureCache.set(tier.id, textures);
  }

  return textures;
}

function getFrameTexture(frameName: string): PixiTexture | undefined {
  const cached = frameTextureCache.get(frameName);
  if (cached) {
    return cached;
  }

  const spritesheet = getSpritesheet();
  if (!spritesheet) {
    return undefined;
  }

  const texture = spritesheet.textures?.[frameName];
  if (texture) {
    frameTextureCache.set(frameName, texture);
    return texture;
  }

  return undefined;
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
    graphics.fill({ color: tier.color });

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

function setSpriteFrameIndex(sprite: PieceSpriteWithFrames, frameIndex: number): void {
  const textures = sprite.pieceFrameTextures;
  if (!textures?.length) {
    return;
  }

  const clamped = Math.max(0, Math.min(frameIndex, textures.length - 1));
  if (sprite.pieceFrameIndex === clamped && sprite.texture === textures[clamped]) {
    return;
  }

  sprite.pieceFrameIndex = clamped;
  sprite.texture = textures[clamped];
  applyScaleForTexture(sprite, textures[clamped]);
}

function applyScaleForTexture(sprite: PieceSpriteWithFrames, texture: PixiTexture): void {
  const targetDiameter = sprite.pieceTargetDiameter;
  if (!targetDiameter || targetDiameter <= 0) {
    return;
  }

  const baseWidth = getTextureBaseWidth(texture);
  if (baseWidth > 0) {
    const scale = targetDiameter / baseWidth;
    sprite.scale.set(scale);
  }
}

function findActiveFrameIndex(frames?: string[]): number | undefined {
  if (!frames || frames.length === 0) {
    return undefined;
  }

  const explicitIndex = frames.findIndex((frameName) => frameName.endsWith('-1'));
  if (explicitIndex >= 0) {
    return explicitIndex;
  }

  return frames.length > 1 ? 1 : undefined;
}

export function setPieceSpriteMovementState(sprite: PixiSprite, isMoving: boolean): void {
  const spriteWithFrames = sprite as PieceSpriteWithFrames;
  const activeIndex = spriteWithFrames.pieceActiveFrameIndex;
  if (activeIndex === undefined) {
    return;
  }

  const targetIndex = isMoving ? activeIndex : 0;
  setSpriteFrameIndex(spriteWithFrames, targetIndex);
}
