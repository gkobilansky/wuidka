import { PixiContainer, PixiSprite, PixiText, PixiGraphics } from "../../plugins/engine";
import { ScoreDisplaySprite } from "../sprites";
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
    private scoreDisplay: ScoreDisplaySprite;
    // Combo notifications
    private comboText?: PixiText; // deprecated static combo (kept optional for compatibility)
    private comboNotifications: { node: PixiText; vx: number; vy: number; life: number; initialLife: number }[] = [];
    private ghostPiece: PixiSprite;
    private dangerLine: PixiGraphics;
    private floorRect: PixiGraphics;
    private gameBoard: PixiGraphics;
    private debugComboText?: PixiText;
    
    // Game state
    private score: number = 0;
    private currentCombo: number = 0;
    private gameWidth: number;
    private gameHeight: number;
    private isDropping: boolean = false;
    
    // Piece tracking
    private pieceSprites: Map<string, PixiSprite> = new Map();

    constructor() {
        super();
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
        this.physicsWorld = new PhysicsWorld(this.gameWidth, this.gameHeight, false); // Debug disabled
        
        // Initialize spawner
        this.spawner = new Spawner();
        
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
        // Create interactive game board background
        this.gameBoard = new PixiGraphics();
        this.gameBoard.rect(0, 0, this.gameWidth, this.gameHeight);
        this.gameBoard.fill(0x000000, 0.01); // Nearly transparent but interactive
        this.gameBoard.interactive = true;
        this.addChild(this.gameBoard);
        
        // Score display (upper-left) using dedicated sprite
        this.scoreDisplay = new ScoreDisplaySprite({ width: 180, height: 44, fontSize: 40, textColor: 0x60a5fa });
        this.scoreDisplay.position.set(12, 12);
        this.addChild(this.scoreDisplay);
        
        // Static combo display removed; we now spawn floating notifications on combo
        // Add small debug text to inspect combo/notification positions
        this.debugComboText = new PixiText({
            text: '',
            style: {
                fontFamily: 'Arial',
                fontSize: 12,
                fill: 0x111827, // dark gray for white backgrounds
                align: 'left',
                stroke: 0xffffff,
                strokeThickness: 1,
            }
        });
        this.debugComboText.position.set(12, 56);
        this.addChild(this.debugComboText);
        

        
        // Floor rectangle
        const floorThickness = 20;
        const floorY = this.gameHeight - floorThickness / 2;
        this.floorRect = new PixiGraphics();
        this.floorRect.rect(0, floorY - floorThickness / 2, this.gameWidth, floorThickness);
        this.floorRect.fill(0x8B4513); // Brown color for floor
        this.addChild(this.floorRect);
        
        // Ghost piece for aiming (positioned at top center)
        this.ghostPiece = this.createTierSprite(this.spawner.getCurrentTier());
        this.ghostPiece.alpha = 0.5;
        this.ghostPiece.position.set(this.gameWidth / 2, 40);
        this.addChild(this.ghostPiece);
    }
    
    private setupInput(): void {
        this.gameBoard.on('pointerdown', this.onPointerDown.bind(this));
    }
    
    private onPointerDown(event: any): void {
        if (this.isDropping) return;
        if (!this.spawner.canDrop()) return;
        
        // Get click/touch position
        const localPos = event.data.getLocalPosition(this.gameBoard);
        const currentTier = this.spawner.getCurrentTier();
        
        // Clamp drop position to playable area
        const minX = currentTier.radius;
        const maxX = this.gameWidth - currentTier.radius;
        const dropX = Math.max(minX, Math.min(maxX, localPos.x));
        
        // Prevent event bubbling
        event.stopPropagation();
        
        this.moveAndDropPiece(dropX);
    }
    
    private moveAndDropPiece(dropX: number): void {
        // Double-check conditions at the moment of dropping
        if (this.isDropping) return;
        if (!this.spawner.canDrop()) return;
        
        this.isDropping = true;
        
        // Get current tier before consuming it
        const tier = this.spawner.getCurrentTier();
        
        // Animate ghost piece moving to target position
        const startX = this.ghostPiece.position.x;
        const startTime = Date.now();
        const moveTime = 200; // 200ms to move horizontally
        
        const animateMove = () => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / moveTime, 1);
            
            // Ease out animation
            const easeProgress = 1 - Math.pow(1 - progress, 2);
            this.ghostPiece.position.x = startX + (dropX - startX) * easeProgress;
            
            if (progress < 1) {
                requestAnimationFrame(animateMove);
            } else {
                // Animation complete, drop the piece
                this.dropPiece(tier, dropX);
            }
        };
        
        requestAnimationFrame(animateMove);
    }
    
    private dropPiece(tier: any, dropX: number): void {
        // Consume the piece from spawner
        this.spawner.consumePiece();
        
        // Create physics piece at the target position
        const dropY = 60; // Drop from near the top
        this.physicsWorld.createPiece(tier, dropX, dropY);
        
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
        this.ghostPiece.position.set(this.gameWidth / 2, 40); // Keep centered
        this.addChild(this.ghostPiece);
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
        if (this.scoreDisplay && typeof this.scoreDisplay.setScore === 'function') {
            this.scoreDisplay.setScore(this.score);
        }
    }
    
    private updateComboDisplay(count: number, multiplier: number): void {
        // Spawn a floating, red combo notification on the right side
        if (count > 1) {
            console.log(`[Combo] spawning notification: count=${count}, mult=${multiplier.toFixed(2)}`);
            this.setDebugCombo(`spawn count=${count} mult=${multiplier.toFixed(2)}`);
            this.spawnComboNotification(count, multiplier);
        } else {
            console.log(`[Combo] update: count=${count}, mult=${multiplier.toFixed(2)} (no notification)`);
            this.setDebugCombo(`count=${count} mult=${multiplier.toFixed(2)}`);
        }
    }

    private spawnComboNotification(count: number, multiplier: number): void {
        const text = new PixiText({
            text: `Combo x${count}`,
            style: {
                fontFamily: 'Arial',
                fontSize: 22,
                fill: 0xff0000, // red
                fontWeight: '900',
                align: 'right',
                stroke: 0x000000,
                strokeThickness: 2,
                dropShadow: true,
                dropShadowColor: 0x000000,
                dropShadowBlur: 1,
                dropShadowDistance: 1,
                dropShadowAngle: Math.PI / 3,
            }
        });
        // Right-align anchor so it hugs the right edge
        text.anchor.set(1, 0);
        // Start near the top-right; a bit below the top UI
        const startX = this.gameWidth - 12;
        const startY = 80;
        text.position.set(startX, startY);
        this.addChild(text);

        // Up-right drift velocity (pixels per second)
        const vx = 80;  // rightward
        const vy = -100; // upward
        const life = 1.1; // seconds
        this.comboNotifications.push({ node: text, vx, vy, life, initialLife: life });
        console.log(`[Combo] notification at x=${startX.toFixed(1)}, y=${startY.toFixed(1)}, vx=${vx}, vy=${vy}`);
        this.setDebugCombo(`at ${startX.toFixed(0)},${startY.toFixed(0)} active=${this.comboNotifications.length}`);
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
        
        // Animate floating combo notifications
        if (this.comboNotifications.length) {
            const dt = (framesPassed || 1) / 60; // convert frames to seconds (60fps base)
            for (let i = this.comboNotifications.length - 1; i >= 0; i--) {
                const n = this.comboNotifications[i];
                n.node.position.x += n.vx * dt;
                n.node.position.y += n.vy * dt;
                n.life -= dt;
                n.node.alpha = Math.max(0, n.life / n.initialLife);
                // Remove when off-canvas or life ended
                if (
                    n.life <= 0 ||
                    n.node.position.x > this.gameWidth + 50 ||
                    n.node.position.y < -50
                ) {
                    this.removeChild(n.node);
                    this.comboNotifications.splice(i, 1);
                }
            }
            // Update debug with the first notification's position
            const head = this.comboNotifications[0];
            if (head) {
                this.setDebugCombo(`first ${head.node.position.x.toFixed(0)},${head.node.position.y.toFixed(0)} active=${this.comboNotifications.length}`);
            }
        }
        
        // TODO: Check for game over conditions
    }

    private setDebugCombo(msg: string): void {
        if (!this.debugComboText) return;
        this.debugComboText.text = `combo: ${msg}`;
    }

    resize(parentWidth: number, parentHeight: number): void {
        // Calculate padding for mobile-friendly layout
        const minPadding = 40; // Minimum side padding
        const bottomPadding = 120; // Extra space at bottom for UI
        
        // Calculate available space accounting for padding
        const availableWidth = parentWidth - (minPadding * 2);
        const availableHeight = parentHeight - bottomPadding;
        
        // Scale the game to fit the available space while maintaining aspect ratio
        const scaleX = availableWidth / this.gameWidth;
        const scaleY = availableHeight / this.gameHeight;
        const scale = Math.min(scaleX, scaleY);
        
        this.scale.set(scale);
        
        // Center the game horizontally, with some top padding
        const scaledWidth = this.gameWidth * scale;
        const scaledHeight = this.gameHeight * scale;
        const topPadding = 20;
        
        this.position.set(
            (parentWidth - scaledWidth) / 2,
            topPadding
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
