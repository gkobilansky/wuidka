import { PixiContainer, PixiSprite, PixiText, PixiGraphics } from "../../plugins/engine";
import { Manager, SceneInterface } from "../../entities/manager";
import { PhysicsWorld, GamePiece } from "../../systems/physics-world";
import { Spawner } from "../../systems/spawner";
import { MergeSystem } from "../../systems/merge-system";
import { GAME_CONFIG, TierConfig } from "../../shared/config/game-config";

export class GameScene extends PixiContainer implements SceneInterface {
    private physicsWorld: PhysicsWorld;
    private spawner: Spawner;
    private mergeSystem: MergeSystem;
    
    // UI Elements
    private scoreText: PixiText;
    private comboText: PixiText;
    private nextPiecePreview: PixiSprite;
    private ghostPiece: PixiSprite;
    private dangerLine: PixiGraphics;
    
    // Game state
    private score: number = 0;
    private currentCombo: number = 0;
    private gameWidth: number;
    private gameHeight: number;
    private isDropping: boolean = false;
    private ghostX: number = 0;
    
    // Piece tracking
    private pieceSprites: Map<string, PixiSprite> = new Map();

    constructor() {
        super();
        this.interactive = true;
        this.position.x = 0;
        this.position.y = 0;
        
        // Use game config dimensions
        this.gameWidth = GAME_CONFIG.width;
        this.gameHeight = GAME_CONFIG.height;
        
        this.setupSystems();
        this.setupUI();
        this.setupInput();
    }

    private setupSystems(): void {
        // Initialize physics world
        this.physicsWorld = new PhysicsWorld(this.gameWidth, this.gameHeight, true); // Debug enabled
        
        // Initialize spawner
        this.spawner = new Spawner();
        this.spawner.onPiecePreview = (tier) => {
            this.updateNextPiecePreview(tier);
        };
        
        // Initialize merge system
        this.mergeSystem = new MergeSystem(this.physicsWorld);
        this.mergeSystem.onMergeComplete = (newPiece, mergedTier, score, multiplier) => {
            this.handleMergeComplete(newPiece, mergedTier, score, multiplier);
        };
        this.mergeSystem.onComboUpdate = (count, multiplier) => {
            this.updateComboDisplay(count, multiplier);
        };
        
        // Set up physics callbacks
        this.physicsWorld.onPieceCreated = (piece) => {
            this.createPieceSprite(piece);
        };
        this.physicsWorld.onPieceRemoved = (piece) => {
            this.removePieceSprite(piece);
        };
    }
    
    private setupUI(): void {
        // Score display
        this.scoreText = new PixiText({
            text: 'Score: 0',
            style: {
                fontFamily: 'Arial',
                fontSize: 24,
                fill: 0xffffff,
                align: 'left',
            }
        });
        this.scoreText.position.set(20, 20);
        this.addChild(this.scoreText);
        
        // Combo display
        this.comboText = new PixiText({
            text: '',
            style: {
                fontFamily: 'Arial',
                fontSize: 18,
                fill: 0xffff00,
                align: 'left',
            }
        });
        this.comboText.position.set(20, 50);
        this.addChild(this.comboText);
        
        // Danger line
        this.dangerLine = new PixiGraphics();
        this.dangerLine.setStrokeStyle({ width: 2, color: 0xff0000, alpha: 0.7 });
        this.dangerLine.moveTo(0, GAME_CONFIG.dangerLineY);
        this.dangerLine.lineTo(this.gameWidth, GAME_CONFIG.dangerLineY);
        this.dangerLine.stroke();
        this.addChild(this.dangerLine);
        
        // Next piece preview (top right)
        this.nextPiecePreview = this.createTierSprite(this.spawner.getNextTier());
        this.nextPiecePreview.position.set(this.gameWidth - 80, 50);
        this.addChild(this.nextPiecePreview);
        
        // Ghost piece for aiming
        this.ghostPiece = this.createTierSprite(this.spawner.getCurrentTier());
        this.ghostPiece.alpha = 0.5;
        this.ghostPiece.position.set(this.gameWidth / 2, 80);
        this.addChild(this.ghostPiece);
    }
    
    private setupInput(): void {
        this.on('pointerdown', this.onPointerDown.bind(this));
        this.on('pointermove', this.onPointerMove.bind(this));
        this.on('pointerup', this.onPointerUp.bind(this));
    }
    
    private onPointerMove(event: any): void {
        if (this.isDropping) return;
        
        const localPos = event.data.getLocalPosition(this);
        const currentTier = this.spawner.getCurrentTier();
        
        // Clamp ghost position to playable area
        const minX = currentTier.radius;
        const maxX = this.gameWidth - currentTier.radius;
        this.ghostX = Math.max(minX, Math.min(maxX, localPos.x));
        
        this.ghostPiece.position.x = this.ghostX;
    }
    
    private onPointerDown(event: any): void {
        // Update ghost position on touch start
        this.onPointerMove(event);
    }
    
    private onPointerUp(event: any): void {
        if (this.isDropping) return;
        if (!this.spawner.canDrop()) return;
        
        this.dropPiece();
    }
    
    private dropPiece(): void {
        this.isDropping = true;
        
        // Get current tier and consume it
        const tier = this.spawner.consumePiece();
        
        // Create physics piece at ghost position
        const dropY = 100; // Above the play area
        this.physicsWorld.createPiece(tier, this.ghostX, dropY);
        
        // Update ghost piece to show next piece
        this.updateGhostPiece();
        
        // Small delay before allowing next drop
        setTimeout(() => {
            this.isDropping = false;
        }, 200);
    }
    
    private updateGhostPiece(): void {
        const currentTier = this.spawner.getCurrentTier();
        this.removeChild(this.ghostPiece);
        this.ghostPiece = this.createTierSprite(currentTier);
        this.ghostPiece.alpha = 0.5;
        this.ghostPiece.position.set(this.ghostX, 80);
        this.addChild(this.ghostPiece);
    }
    
    private updateNextPiecePreview(tier: TierConfig): void {
        this.removeChild(this.nextPiecePreview);
        this.nextPiecePreview = this.createTierSprite(tier);
        this.nextPiecePreview.position.set(this.gameWidth - 80, 50);
        this.addChild(this.nextPiecePreview);
    }
    
    private createTierSprite(tier: TierConfig): PixiSprite {
        // Create a simple colored circle for now
        // TODO: Replace with actual tier textures from atlas
        const graphics = new PixiGraphics();
        const color = this.getTierColor(tier.id);
        graphics.circle(0, 0, tier.radius);
        graphics.fill(color);
        
        // Convert graphics to texture and create sprite
        const texture = Manager.app?.renderer.generateTexture(graphics);
        const sprite = PixiSprite.from(texture);
        sprite.anchor.set(0.5);
        return sprite;
    }
    
    private getTierColor(tierId: number): number {
        const colors = [
            0xff0000, // Red
            0xff8000, // Orange
            0xffff00, // Yellow
            0x80ff00, // Lime
            0x00ff00, // Green
            0x00ff80, // Spring Green
            0x00ffff, // Cyan
            0x0080ff, // Sky Blue
            0x0000ff, // Blue
            0x8000ff, // Purple
            0xff00ff, // Magenta
            0xff0080  // Pink
        ];
        return colors[(tierId - 1) % colors.length];
    }
    
    private createPieceSprite(piece: GamePiece): void {
        const sprite = this.createTierSprite(piece.tier);
        sprite.position.set(piece.body.position.x, piece.body.position.y);
        this.addChild(sprite);
        this.pieceSprites.set(piece.id, sprite);
    }
    
    private removePieceSprite(piece: GamePiece): void {
        const sprite = this.pieceSprites.get(piece.id);
        if (sprite) {
            this.removeChild(sprite);
            this.pieceSprites.delete(piece.id);
        }
    }
    
    private handleMergeComplete(newPiece: GamePiece, mergedTier: TierConfig, score: number, multiplier: number): void {
        this.score += score;
        this.updateScoreDisplay();
        
        // TODO: Add merge effects, particle systems, sound effects
    }
    
    private updateScoreDisplay(): void {
        this.scoreText.text = `Score: ${this.score}`;
    }
    
    private updateComboDisplay(count: number, multiplier: number): void {
        if (count > 1) {
            this.comboText.text = `Combo x${count} (${multiplier.toFixed(1)}x)`;
        } else {
            this.comboText.text = '';
        }
    }
    
    private syncPhysicsToSprites(): void {
        // Update all piece sprites to match their physics bodies
        for (const [pieceId, sprite] of this.pieceSprites) {
            const piece = this.physicsWorld.getPiece(pieceId);
            if (piece) {
                sprite.position.set(piece.body.position.x, piece.body.position.y);
                sprite.rotation = piece.body.angle;
            }
        }
    }

    update(framesPassed: number): void {
        // Update game systems
        this.physicsWorld.update(framesPassed);
        this.mergeSystem.update(framesPassed);
        
        // Sync visual sprites with physics
        this.syncPhysicsToSprites();
        
        // TODO: Check for game over conditions
    }

    resize(parentWidth: number, parentHeight: number): void {
        // Scale the game to fit the screen while maintaining aspect ratio
        const scaleX = parentWidth / this.gameWidth;
        const scaleY = parentHeight / this.gameHeight;
        const scale = Math.min(scaleX, scaleY);
        
        this.scale.set(scale);
        
        // Center the game
        this.position.set(
            (parentWidth - this.gameWidth * scale) / 2,
            (parentHeight - this.gameHeight * scale) / 2
        );
    }
    
    destroy(): void {
        // Clean up physics world
        if (this.physicsWorld) {
            this.physicsWorld.destroy();
        }
        
        // Clean up sprites
        this.pieceSprites.clear();
        
        super.destroy();
    }
}