import { PixiText, PixiGraphics, PixiContainer } from "../../plugins/engine";

export interface ButtonConfig {
    text: string;
    width: number;
    height: number;
    backgroundColor?: number;
    textColor?: number;
    borderColor?: number;
    fontSize?: number;
}

export class ButtonSprite extends PixiContainer {
    private background: PixiGraphics;
    private label: PixiText;
    private config: ButtonConfig;
    private isPressed: boolean = false;
    
    constructor(config: ButtonConfig) {
        super();
        this.config = {
            backgroundColor: 0x4a5568,
            textColor: 0xffffff,
            borderColor: 0x2d3748,
            fontSize: 16,
            ...config
        };
        
        this.interactive = true;
        this.cursor = 'pointer';
        
        this.createBackground();
        this.createLabel();
        this.setupInteraction();
    }
    
    private createBackground(): void {
        this.background = new PixiGraphics();
        this.drawBackground(false);
        this.addChild(this.background);
    }
    
    private createLabel(): void {
        this.label = new PixiText({
            text: this.config.text,
            style: {
                fontFamily: 'Arial',
                fontSize: this.config.fontSize,
                fill: this.config.textColor,
                align: 'center',
            }
        });
        
        this.label.anchor.set(0.5);
        this.label.position.set(this.config.width / 2, this.config.height / 2);
        this.addChild(this.label);
    }
    
    private drawBackground(pressed: boolean): void {
        this.background.clear();
        
        const bgColor = pressed ? 
            (this.config.backgroundColor! * 0.8) : 
            this.config.backgroundColor!;
            
        this.background
            .roundRect(0, 0, this.config.width, this.config.height, 8)
            .fill(bgColor)
            .stroke({ width: 2, color: this.config.borderColor });
    }
    
    private setupInteraction(): void {
        this.on('pointerdown', this.onPointerDown.bind(this));
        this.on('pointerup', this.onPointerUp.bind(this));
        this.on('pointerupoutside', this.onPointerUp.bind(this));
        this.on('pointerover', this.onPointerOver.bind(this));
        this.on('pointerout', this.onPointerOut.bind(this));
    }
    
    private onPointerDown(): void {
        this.isPressed = true;
        this.drawBackground(true);
        this.scale.set(0.95);
    }
    
    private onPointerUp(): void {
        if (this.isPressed) {
            this.isPressed = false;
            this.drawBackground(false);
            this.scale.set(1);
            this.emit('click');
        }
    }
    
    private onPointerOver(): void {
        if (!this.isPressed) {
            this.scale.set(1.05);
        }
    }
    
    private onPointerOut(): void {
        if (!this.isPressed) {
            this.scale.set(1);
        }
        this.isPressed = false;
        this.drawBackground(false);
    }
    
    public setText(text: string): void {
        this.label.text = text;
    }
    
    public setEnabled(enabled: boolean): void {
        this.interactive = enabled;
        this.alpha = enabled ? 1 : 0.5;
        this.cursor = enabled ? 'pointer' : 'default';
    }
}