import { PixiContainer, PixiGraphics, PixiText } from '../../plugins/engine';
import { ButtonSprite } from '../sprites';

interface GameOverOverlayOptions {
  width: number;
  height: number;
  score: number;
  onRestart: () => void;
}

export class GameOverOverlayComponent extends PixiContainer {
  private readonly background: PixiGraphics;
  private readonly titleText: PixiText;
  private readonly scoreText: PixiText;
  private readonly restartButton: ButtonSprite;
  private readonly handleRestart: () => void;

  constructor(options: GameOverOverlayOptions) {
    super();

    const { width, height, score, onRestart } = options;
    this.interactive = true;

    this.background = new PixiGraphics();
    this.background.rect(0, 0, width, height);
    this.background.fill({ color: 0x000000 });
    this.background.alpha = 0.5;
    this.addChild(this.background);

    this.titleText = new PixiText({
      text: 'Game Over',
      style: {
        fontFamily: 'Arial',
        fontSize: 48,
        fill: 0xffffff,
        fontWeight: '900',
        align: 'center',
        stroke: { color: 0x000000, width: 4 },
        dropShadow: {
          color: 0x000000,
          blur: 2,
          distance: 2,
          alpha: 1
        }
      }
    });
    this.titleText.anchor.set(0.5);
    this.titleText.position.set(width / 2, height / 2 - 40);
    this.addChild(this.titleText);

    this.scoreText = new PixiText({
      text: this.formatScore(score),
      style: {
        fontFamily: 'Arial',
        fontSize: 28,
        fill: 0xffffff,
        fontWeight: '700',
        align: 'center',
        stroke: { color: 0x000000, width: 3 },
        dropShadow: {
          color: 0x000000,
          blur: 2,
          distance: 2,
          alpha: 1
        }
      }
    });
    this.scoreText.anchor.set(0.5);
    this.scoreText.position.set(width / 2, this.titleText.position.y + 56);
    this.addChild(this.scoreText);

    const buttonWidth = 200;
    const buttonHeight = 52;
    this.restartButton = new ButtonSprite({
      text: 'Start Over',
      width: buttonWidth,
      height: buttonHeight,
      backgroundColor: 0x3b82f6,
      borderColor: 0x1d4ed8,
      textColor: 0xffffff,
      fontSize: 20
    });
    this.restartButton.position.set((width - buttonWidth) / 2, this.scoreText.position.y + 40);
    this.addChild(this.restartButton);

    this.handleRestart = () => {
      onRestart();
    };
    this.restartButton.on('pointertap', this.handleRestart);
  }

  public updateScore(score: number): void {
    this.scoreText.text = this.formatScore(score);
  }

  private formatScore(score: number): string {
    return `Score: ${score}`;
  }

  override destroy(options?: any): void {
    this.restartButton.off('pointertap', this.handleRestart);
    super.destroy(options);
  }
}
