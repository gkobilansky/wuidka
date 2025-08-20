import { PixiText, PixiGraphics, PixiContainer } from "../../plugins/engine";

export interface ComboDisplayConfig {
    width?: number;
    height?: number;
    backgroundColor?: number;
    textColor?: number;
    comboColor?: number;
    fontSize?: number;
    padding?: number;
}

export class ComboDisplaySprite extends PixiContainer {
    private background: PixiGraphics;
    private comboText: PixiText;
    private multiplierText: PixiText;
    private config: ComboDisplayConfig;
    private currentCombo: number = 0;
    private currentMultiplier: number = 1;
    private pulseScale: number = 1;
    private isVisible: boolean = false;
    
    constructor(config: ComboDisplayConfig = {}) {
        super();
        this.config = {
            width: 150,
            height: 70,
            backgroundColor: 0x2d3748,
            textColor: 0xffffff,
            comboColor: 0xffd700,
            fontSize: 16,
            padding: 8,
            ...config
        };
        
        this.createBackground();
        this.createTexts();
        this.visible = false;
    }
    
    private createBackground(): void {
        this.background = new PixiGraphics();
        this.background
            .roundRect(0, 0, this.config.width!, this.config.height!, 10)
            .fill(this.config.backgroundColor!)
            .stroke({ width: 2, color: this.config.comboColor!, alpha: 0.8 });
        this.addChild(this.background);
    }
    
    private createTexts(): void {
        this.comboText = new PixiText({
            text: 'COMBO',
            style: {
                fontFamily: 'Arial',
                fontSize: this.config.fontSize! * 0.8,
                fill: this.config.textColor,
                fontWeight: 'bold',
                align: 'center',
            }
        });
        
        this.comboText.anchor.set(0.5, 0);
        this.comboText.position.set(this.config.width! / 2, this.config.padding!);
        this.addChild(this.comboText);
        
        this.multiplierText = new PixiText({
            text: '2x',
            style: {
                fontFamily: 'Arial',
                fontSize: this.config.fontSize! * 1.4,
                fill: this.config.comboColor,
                fontWeight: 'bold',
                align: 'center',
            }
        });
        
        this.multiplierText.anchor.set(0.5, 1);
        this.multiplierText.position.set(this.config.width! / 2, this.config.height! - this.config.padding!);
        this.addChild(this.multiplierText);
    }
    
    public showCombo(comboCount: number, multiplier: number): void {
        this.currentCombo = comboCount;
        this.currentMultiplier = multiplier;
        
        if (comboCount <= 1) {
            this.hide();
            return;
        }
        
        this.updateDisplay();
        this.show();
        this.pulse();
    }
    
    private updateDisplay(): void {
        this.comboText.text = `COMBO x${this.currentCombo}`;
        this.multiplierText.text = `${this.currentMultiplier.toFixed(1)}x`;
        
        // Change color based on combo level
        let color = this.config.comboColor!;
        if (this.currentCombo >= 5) {
            color = 0xff6b6b; // Red for high combos
        } else if (this.currentCombo >= 3) {
            color = 0xff8c42; // Orange for medium combos
        }
        
        this.multiplierText.style.fill = color;
        this.background.clear();
        this.background
            .roundRect(0, 0, this.config.width!, this.config.height!, 10)
            .fill(this.config.backgroundColor!)
            .stroke({ width: 2, color: color, alpha: 0.8 });
    }
    
    private show(): void {
        this.visible = true;
        this.isVisible = true;
        this.alpha = 0;
        this.scale.set(0.5);
        
        // Fade in animation
        this.fadeIn();
    }
    
    private hide(): void {
        if (!this.isVisible) return;
        
        this.isVisible = false;
        this.fadeOut();
    }
    
    private fadeIn(): void {
        const startTime = Date.now();
        const duration = 200;
        
        const animate = () => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);
            
            this.alpha = progress;
            this.scale.set(0.5 + (progress * 0.5));
            
            if (progress < 1) {
                requestAnimationFrame(animate);
            }
        };
        
        animate();
    }
    
    private fadeOut(): void {
        const startTime = Date.now();
        const duration = 300;
        
        const animate = () => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);
            
            this.alpha = 1 - progress;
            this.scale.set(1 - (progress * 0.2));
            
            if (progress < 1) {
                requestAnimationFrame(animate);
            } else {
                this.visible = false;
            }
        };
        
        animate();
    }
    
    private pulse(): void {
        if (!this.isVisible) return;
        
        const startTime = Date.now();
        const duration = 400;
        
        const animate = () => {
            if (!this.isVisible) return;
            
            const elapsed = Date.now() - startTime;
            const progress = (elapsed / duration) % 1;
            
            // Sine wave pulse
            const pulseAmount = Math.sin(progress * Math.PI * 2) * 0.1;
            this.pulseScale = 1 + pulseAmount;
            
            this.multiplierText.scale.set(this.pulseScale);
            
            requestAnimationFrame(animate);
        };
        
        animate();
    }
    
    public reset(): void {
        this.currentCombo = 0;
        this.currentMultiplier = 1;
        this.hide();
    }
    
    public getComboCount(): number {
        return this.currentCombo;
    }
    
    public getMultiplier(): number {
        return this.currentMultiplier;
    }
}