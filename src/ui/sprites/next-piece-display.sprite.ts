import { PixiText, PixiGraphics, PixiContainer, PixiSprite } from "../../plugins/engine";
import { TierConfig } from "../../shared/config/game-config";
import { Manager } from "../../entities/manager";

export interface NextPieceDisplayConfig {
    width?: number;
    height?: number;
    backgroundColor?: number;
    textColor?: number;
    borderColor?: number;
    fontSize?: number;
    padding?: number;
}

export class NextPieceDisplaySprite extends PixiContainer {
    private background!: PixiGraphics;
    private titleLabel!: PixiText;
    private pieceSprite?: PixiSprite;
    private config: NextPieceDisplayConfig;
    private currentTier?: TierConfig;
    
    constructor(config: NextPieceDisplayConfig = {}) {
        super();
        this.config = {
            width: 120,
            height: 120,
            backgroundColor: 0x1a202c,
            textColor: 0xffffff,
            borderColor: 0x4a5568,
            fontSize: 14,
            padding: 8,
            ...config
        };
        
        this.createBackground();
        this.createTitle();
    }
    
    private createBackground(): void {
        this.background = new PixiGraphics();
        this.background
            .roundRect(0, 0, this.config.width!, this.config.height!, 8)
            .fill(this.config.backgroundColor!)
            .stroke({ width: 2, color: this.config.borderColor });
        this.addChild(this.background);
    }
    
    private createTitle(): void {
        this.titleLabel = new PixiText({
            text: 'NEXT',
            style: {
                fontFamily: 'Arial',
                fontSize: this.config.fontSize,
                fill: this.config.textColor,
                fontWeight: 'bold',
                align: 'center'
            }
        });
        
        this.titleLabel.anchor.set(0.5, 0);
        this.titleLabel.position.set(this.config.width! / 2, this.config.padding!);
        this.addChild(this.titleLabel);
    }
    
    private createTierSprite(tier: TierConfig): PixiSprite {
        const graphics = new PixiGraphics();
        const color = this.getTierColor(tier.id);
        
        // Scale the piece to fit nicely in the display
        const maxRadius = Math.min(this.config.width!, this.config.height!) / 3;
        const scaledRadius = Math.min(tier.radius * 0.8, maxRadius);
        
        graphics.circle(0, 0, scaledRadius);
        graphics.fill(color);
        
        // Add a subtle border
        graphics.circle(0, 0, scaledRadius);
        graphics.stroke({ width: 2, color: 0xffffff, alpha: 0.3 });
        
        const renderer = Manager.app?.renderer;
        if (!renderer) {
            throw new Error('Pixi renderer not initialized');
        }
        const texture = renderer.generateTexture(graphics);
        const sprite = PixiSprite.from(texture);
        sprite.anchor.set(0.5);
        return sprite;
    }
    
    private getTierColor(tierId: number): number {
        const colors = [
            0xff4444, // Red
            0xff8844, // Orange
            0xffff44, // Yellow
            0x88ff44, // Lime
            0x44ff44, // Green
            0x44ff88, // Spring Green
            0x44ffff, // Cyan
            0x4488ff, // Sky Blue
            0x4444ff, // Blue
            0x8844ff, // Purple
            0xff44ff, // Magenta
            0xff4488  // Pink
        ];
        return colors[(tierId - 1) % colors.length];
    }
    
    public setNextPiece(tier: TierConfig): void {
        // Remove existing piece sprite
        if (this.pieceSprite) {
            this.removeChild(this.pieceSprite);
        }
        
        this.currentTier = tier;
        this.pieceSprite = this.createTierSprite(tier);
        
        // Position the piece in the center of the display area
        const displayCenterY = this.config.padding! + this.titleLabel.height + 
                              (this.config.height! - this.config.padding! * 2 - this.titleLabel.height) / 2;
        
        this.pieceSprite.position.set(this.config.width! / 2, displayCenterY);
        this.addChild(this.pieceSprite);
    }
    
    public getCurrentTier(): TierConfig | undefined {
        return this.currentTier;
    }
    
    public clear(): void {
        if (this.pieceSprite) {
            this.removeChild(this.pieceSprite);
            this.pieceSprite = undefined;
        }
        this.currentTier = undefined;
    }
}
