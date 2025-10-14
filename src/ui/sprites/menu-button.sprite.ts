import { PixiText, PixiGraphics, PixiContainer } from "../../plugins/engine";
import { FederatedPointerEvent } from 'pixi.js';

export interface MenuButtonConfig {
    text: string;
    width?: number;
    height?: number;
    backgroundColor?: number;
    hoverColor?: number;
    textColor?: number;
    fontSize?: number;
    icon?: string;
}

export class MenuButtonSprite extends PixiContainer {
    private background!: PixiGraphics;
    private labelText!: PixiText;
    private iconText?: PixiText;
    private config: MenuButtonConfig;
    private defaultColor: number;
    
    constructor(config: MenuButtonConfig) {
        super();
        this.config = {
            width: 280,
            height: 60,
            backgroundColor: 0x2d3748,
            hoverColor: 0x4a5568,
            textColor: 0xffffff,
            fontSize: 20,
            ...config
        };
        
        this.defaultColor = this.config.backgroundColor!;
        this.interactive = true;
        this.cursor = 'pointer';
        
        this.createBackground();
        this.createLabel();
        if (this.config.icon) {
            this.createIcon();
        }
        this.setupInteraction();
    }
    
    private createBackground(): void {
        this.background = new PixiGraphics();
        this.drawBackground(this.defaultColor);
        this.addChild(this.background);
    }
    
    private createLabel(): void {
        this.labelText = new PixiText({
            text: this.config.text,
            style: {
                fontFamily: 'Arial',
                fontSize: this.config.fontSize,
                fill: this.config.textColor,
                fontWeight: 'bold',
                align: 'center'
            }
        });
        
        this.labelText.anchor.set(0.5);
        
        // Adjust position based on whether there's an icon
        const textX = this.config.icon ? 
            this.config.width! * 0.6 : 
            this.config.width! / 2;
        
        this.labelText.position.set(textX, this.config.height! / 2);
        this.addChild(this.labelText);
    }
    
    private createIcon(): void {
        if (!this.config.icon) return;
        
        this.iconText = new PixiText({
            text: this.config.icon,
            style: {
                fontFamily: 'Arial',
                fontSize: this.config.fontSize! * 1.2,
                fill: this.config.textColor,
                align: 'center'
            }
        });
        
        this.iconText.anchor.set(0.5);
        this.iconText.position.set(this.config.width! * 0.25, this.config.height! / 2);
        this.addChild(this.iconText);
    }
    
    private drawBackground(color: number): void {
        this.background.clear();
        
        // Rounded rectangle with gradient effect
        this.background
            .roundRect(0, 0, this.config.width!, this.config.height!, 12)
            .fill({ color });
            
        // Add subtle border
        this.background
            .roundRect(0, 0, this.config.width!, this.config.height!, 12)
            .stroke({ width: 2, color: 0xffffff, alpha: 0.1 });
    }
    
    private setupInteraction(): void {
        this.on('pointerover', this.onPointerOver.bind(this));
        this.on('pointerout', this.onPointerOut.bind(this));
        this.on('pointerdown', this.onPointerDown.bind(this));
        this.on('pointerup', this.onPointerUp.bind(this));
        this.on('pointerupoutside', this.onPointerUpOutside.bind(this));
    }
    
    private onPointerOver(): void {
        this.drawBackground(this.config.hoverColor!);
        this.scale.set(1.02);
    }
    
    private onPointerOut(): void {
        this.drawBackground(this.defaultColor);
        this.scale.set(1);
    }
    
    private onPointerDown(): void {
        this.scale.set(0.98);
        this.drawBackground(this.defaultColor * 0.8);
    }
    
    private onPointerUp(event: FederatedPointerEvent): void {
        this.scale.set(1.02);
        this.drawBackground(this.config.hoverColor!);
        this.emit('pointertap', event);
    }
    
    private onPointerUpOutside(): void {
        this.scale.set(1);
        this.drawBackground(this.defaultColor);
    }
    
    public setText(text: string): void {
        this.labelText.text = text;
    }
    
    public setIcon(icon: string): void {
        if (this.iconText) {
            this.iconText.text = icon;
        }
    }
    
    public setEnabled(enabled: boolean): void {
        this.interactive = enabled;
        this.alpha = enabled ? 1 : 0.5;
        this.cursor = enabled ? 'pointer' : 'default';
    }
}
