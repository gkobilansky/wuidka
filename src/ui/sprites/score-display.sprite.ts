import { PixiText, PixiContainer } from "../../plugins/engine";

export interface ScoreDisplayConfig {
    width?: number;
    height?: number;
    backgroundColor?: number; // unused (background removed)
    textColor?: number;
    borderColor?: number; // unused (border removed)
    fontSize?: number;
    padding?: number;
}

export class ScoreDisplaySprite extends PixiContainer {
    private scoreValue!: PixiText;
    private config: ScoreDisplayConfig;
    private currentScore: number = 0;
    
    constructor(config: ScoreDisplayConfig = {}) {
        super();
        this.config = {
            width: 200,
            height: 48,
            backgroundColor: 0x000000,
            textColor: 0xD7D788,
            borderColor: 0x000000,
            fontSize: 42, 
            padding: 8,
            ...config
        };

        // Background intentionally omitted for a cleaner look
        // this.createBackground();
        this.createValue();
    }
    
    private createValue(): void {
        this.scoreValue = new PixiText({
            text: '0',
            style: {
                fontFamily: 'Arial',
                fontSize: this.config.fontSize!,
                fill: this.config.textColor,
                fontWeight: '900',
                align: 'left',
                // subtle stroke and minimal shadow for contrast
                stroke: { color: 0x000000, width: 1 },
                dropShadow: {
                    color: 0x000000,
                    blur: 1,
                    distance: 1,
                    angle: Math.PI / 3,
                    alpha: 1
                }
            }
        });

        this.scoreValue.anchor.set(0, 0);
        this.scoreValue.position.set(0, 0);
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
