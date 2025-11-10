import type { Spritesheet, Texture } from 'pixi.js';
import { PixiAssets } from '../../plugins/engine';
import { GAME_CONFIG, TierConfig } from '../../shared/config/game-config';

export class ScorePanelComponent {
    private readonly listId: string;
    private readonly bitmapDataUrlCache = new WeakMap<object, string>();

    constructor(listId: string = 'friends-panel') {
        this.listId = listId;
    }

    public render(): void {
        const list = document.getElementById(this.listId);
        if (!list) return;

        const spritesheet = PixiAssets.get('pieces-atlas-data') as Spritesheet | undefined;
        list.innerHTML = '';

        const header = document.createElement('div');
        header.className = 'friends-panel__header';

        const title = document.createElement('h2');
        title.textContent = 'Friends';
        header.appendChild(title);

        const description = document.createElement('p');
        description.className = 'friends-panel__description';
        header.appendChild(description);

        list.appendChild(header);

        const itemsContainer = document.createElement('div');
        itemsContainer.className = 'friends-panel__items';
        list.appendChild(itemsContainer);

        for (const tier of GAME_CONFIG.tiers) {
            const item = document.createElement('div');
            item.className = 'score-item';

            const thumb = document.createElement('div');
            thumb.className = 'score-thumb';
            thumb.style.backgroundColor = this.colorToCss(tier.color);
            item.appendChild(thumb);

            const meta = document.createElement('div');
            meta.className = 'score-meta';

            const name = document.createElement('div');
            name.className = 'score-name';
            name.textContent = `${tier.name}`;
            meta.appendChild(name);
            item.appendChild(meta);

            const value = document.createElement('div');
            value.className = 'score-value';
            value.textContent = `${tier.points}`;
            item.appendChild(value);

            itemsContainer.appendChild(item);

            const texture = this.pickTierTexture(spritesheet, tier);
            if (texture) {
                this.applyThumbTexture(thumb, texture);
            }
        }
    }

    private pickTierTexture(spritesheet: Spritesheet | undefined, tier: TierConfig): Texture | undefined {
        if (!spritesheet) return undefined;
        for (const frameName of tier.frames) {
            const texture = spritesheet.textures?.[frameName];
            if (texture) {
                return texture;
            }
        }
        return undefined;
    }

    private applyThumbTexture(element: HTMLElement, texture: Texture): void {
        const { url, width, height } = this.getTextureSourceMeta(texture);

        if (!url || !width || !height) {
            return;
        }

        const frame = texture.frame;
        const computedSize = element.getBoundingClientRect().width
            || parseFloat(getComputedStyle(element).width)
            || 24;
        const scale = computedSize / Math.max(frame.width, frame.height);
        const scaledWidth = width * scale;
        const scaledHeight = height * scale;

        element.style.backgroundImage = `url(${url})`;
        element.style.backgroundRepeat = 'no-repeat';
        element.style.backgroundSize = `${scaledWidth}px ${scaledHeight}px`;
        element.style.backgroundPosition = `${-(frame.x * scale) - 2}px ${-(frame.y * scale) - 2}px`;
        element.style.backgroundColor = 'transparent';
    }

    private colorToCss(color: number): string {
        return `#${color.toString(16).padStart(6, '0')}`;
    }

    private getBitmapDataUrl(bitmap: ImageBitmap): string | undefined {
        let cached = this.bitmapDataUrlCache.get(bitmap);
        if (cached) return cached;

        const canvas = document.createElement('canvas');
        canvas.width = bitmap.width;
        canvas.height = bitmap.height;

        const context = canvas.getContext('2d');
        if (!context) return undefined;

        context.drawImage(bitmap, 0, 0);
        cached = canvas.toDataURL();
        this.bitmapDataUrlCache.set(bitmap, cached);
        return cached;
    }

    private resolveResourceUrl(resource: any, visited = new Set<any>()): string | undefined {
        if (!resource || visited.has(resource)) return undefined;
        visited.add(resource);

        if (typeof resource === 'string') {
            return resource;
        }

        const directUrl = typeof resource.url === 'string'
            ? resource.url
            : typeof resource.src === 'string'
                ? resource.src
                : undefined;
        if (directUrl) {
            return directUrl;
        }

        if (typeof ImageBitmap !== 'undefined' && resource instanceof ImageBitmap) {
            return this.getBitmapDataUrl(resource);
        }

        const nestedSources = [
            resource.source,
            resource.bitmap,
            resource.baseTexture?.resource,
            resource.baseTexture,
            resource.resource
        ];

        for (const nested of nestedSources) {
            const nestedUrl = this.resolveResourceUrl(nested, visited);
            if (nestedUrl) {
                return nestedUrl;
            }
        }

        return undefined;
    }

    private getTextureSourceMeta(texture: Texture): { url?: string; width: number; height: number } {
        const textureAny = texture as any;
        const source = textureAny.source ?? textureAny.baseTexture;
        if (!source) {
            return { width: texture.frame?.width ?? 0, height: texture.frame?.height ?? 0 };
        }

        const resource = source.resource ?? source;
        const url = this.resolveResourceUrl(resource);

        const width = Number(
            source.width ??
            source.realWidth ??
            resource?.width ??
            resource?.naturalWidth ??
            resource?.source?.width ??
            resource?.bitmap?.width ??
            texture.frame?.width ??
            0
        );
        const height = Number(
            source.height ??
            source.realHeight ??
            resource?.height ??
            resource?.naturalHeight ??
            resource?.source?.height ??
            resource?.bitmap?.height ??
            texture.frame?.height ??
            0
        );

        return { url, width, height };
    }
}
