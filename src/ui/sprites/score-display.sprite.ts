import { PixiText, PixiGraphics, PixiContainer } from "../../plugins/engine";

export interface ScoreDisplayConfig {
    width?: number;
    height?: number;
    backgroundColor?: number;
    textColor?: number;
    borderColor?: number;
    fontSize?: number;
    padding?: number;
}

export class ScoreDisplaySprite extends PixiContainer {
    private background: PixiGraphics;
    private scoreLabel: PixiText;
    private scoreValue: PixiText;
    private config: ScoreDisplayConfig;
    private currentScore: number = 0;
    
    constructor(config: ScoreDisplayConfig = {}) {
        super();
        this.config = {
            width: 200,
            height: 80,
            backgroundColor: 0x1a202c,
            textColor: 0xffffff,
            borderColor: 0x4a5568,
            fontSize: 18,
            padding: 12,
            ...config
        };
        
        this.createBackground();
        this.createLabels();
    }
    
    private createBackground(): void {
        this.background = new PixiGraphics();
        this.background
            .roundRect(0, 0, this.config.width!, this.config.height!, 12)
            .fill(this.config.backgroundColor!)
            .stroke({ width: 2, color: this.config.borderColor });
        this.addChild(this.background);
    }
    
    private createLabels(): void {
        this.scoreLabel = new PixiText({
            text: 'SCORE',
            style: {
                fontFamily: 'Arial',
                fontSize: this.config.fontSize! * 0.7,
                fill: this.config.textColor,
                fontWeight: 'bold',
                align: 'center',
            }
        });
        
        this.scoreLabel.anchor.set(0.5, 0);
        this.scoreLabel.position.set(this.config.width! / 2, this.config.padding!);
        this.addChild(this.scoreLabel);
        
        this.scoreValue = new PixiText({
            text: '0',
            style: {
                fontFamily: 'Arial',
                fontSize: this.config.fontSize! * 1.3,
                fill: 0xffd700,
                fontWeight: 'bold',
                align: 'center',
            }
        });
        
        this.scoreValue.anchor.set(0.5, 1);
        this.scoreValue.position.set(this.config.width! / 2, this.config.height! - this.config.padding!);
        this.addChild(this.scoreValue);
    }
    
    public setScore(score: number): void {
        this.currentScore = score;
        this.scoreValue.text = this.formatScore(score);
    }
    
    public addScore(points: number): void {
        this.setScore(this.currentScore + points);
    }
    
    private formatScore(score: number): string {
        if (score < 1000) return score.toString();
        if (score < 1000000) return (score / 1000).toFixed(1) + 'K';
        return (score / 1000000).toFixed(1) + 'M';
    }
    
    public getScore(): number {
        return this.currentScore;
    }
    
    public reset(): void {
        this.setScore(0);
    }
}