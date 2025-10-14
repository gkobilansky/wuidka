import { PixiAnimatedSprite, PixiAssets, PixiTexture } from '../../plugins/engine';

const FRAME_KEYS = [
  'cloud-transform-1',
  'cloud-transform-2',
  'cloud-transform-3',
  'cloud-transform-4'
] as const;

function getTextureBaseWidth(texture: PixiTexture): number {
  const origWidth = (texture as any).orig?.width;
  if (typeof origWidth === 'number' && origWidth > 0) {
    return origWidth;
  }
  return texture.width;
}

export function createCloudTransformEffect(targetDiameter: number): PixiAnimatedSprite | null {
  const textures: PixiTexture[] = [];

  for (const key of FRAME_KEYS) {
    const texture = PixiAssets.get(key) as PixiTexture | undefined;
    if (texture) {
      textures.push(texture);
    }
  }

  if (!textures.length) {
    return null;
  }

  const effect = new PixiAnimatedSprite(textures);
  effect.anchor.set(0.5);
  const baseWidth = getTextureBaseWidth(textures[0]);
  if (baseWidth > 0) {
    const scale = targetDiameter / baseWidth;
    effect.scale.set(scale);
  }

  effect.loop = false;
  effect.animationSpeed = 0.35;
  effect.gotoAndPlay(0);

  return effect;
}
