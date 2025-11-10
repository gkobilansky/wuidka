import { PixiContainer, PixiSprite, PixiText, PixiGraphics, PixiAnimatedSprite } from "../../plugins/engine";
import { ScoreDisplaySprite } from "../sprites";
import { Manager, SceneInterface } from "../../entities/manager";
import { PhysicsWorld, GamePiece } from "../../systems/physics-world";
import { Spawner } from "../../systems/spawner";
import { MergeSystem } from "../../systems/merge-system";
import { GAME_CONFIG, TierConfig } from "../../shared/config/game-config";
import { createPieceSprite } from "../utils/piece-sprite";
import { createCloudTransformEffect } from "../utils/cloud-transform-effect";
import { AudioManager } from "../../shared/audio/audio-manager";
import { GameOverOverlayComponent, type ScoreSubmissionPayload, type ScoreSubmissionResult } from "../components/game-over-overlay.component";
import { submitScore } from "../../api/scores-client";
import { getLeaderboardPanel } from "../state/leaderboard-registry";

export class GameScene extends PixiContainer implements SceneInterface {
    private physicsWorld!: PhysicsWorld;
    private spawner!: Spawner;
    private mergeSystem!: MergeSystem;
    
    // UI Elements
    private scoreDisplay!: ScoreDisplaySprite;
    // Combo notifications
    private comboNotifications: { node: PixiText; vx: number; vy: number; life: number; initialLife: number }[] = [];
    private ghostPiece!: PixiSprite;
    private dangerLine!: PixiGraphics;
    private floorRect!: PixiGraphics;
    private gameBoard!: PixiGraphics;
    private dangerY: number = GAME_CONFIG.dangerLineY;
    private inDangerByPiece: Map<string, number> = new Map(); // pieceId -> turnEntered
    private isGameOver: boolean = false;
    private dangerSuppressUntil: number = 0; // timestamp (ms) until which we hide danger line for new drops
    private scoreUiHeight: number = 44; // mirrors ScoreDisplay config height
    private isDangerActive: boolean = false;
    
    // Game state
    private score: number = 0;
    private gameWidth: number;
    private gameHeight: number;
    private isDropping: boolean = false;
    
    // Piece tracking
    private pieceSprites: Map<string, PixiSprite> = new Map();
    private mergeEffects: PixiAnimatedSprite[] = [];
    private gameOverOverlay?: GameOverOverlayComponent;
    private readonly handleScoreSubmission = (payload: ScoreSubmissionPayload, options?: { signal?: AbortSignal }): Promise<ScoreSubmissionResult> => {
        return submitScore(payload, { signal: options?.signal });
    };

    constructor() {
        super();
        this.position.x = 0;
        this.position.y = 0;
        AudioManager.init();
        
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
            this.attachPieceSprite(piece);
        };
        this.physicsWorld.onPieceRemoved = (piece) => {
            this.removePieceSprite(piece);
        };
    }
    
    private setupUI(): void {
        // Create interactive game board background
        this.gameBoard = new PixiGraphics();
        this.gameBoard.rect(0, 0, this.gameWidth, this.gameHeight);
        this.gameBoard.fill({ color: 0x000000, alpha: 0.01 }); // Nearly transparent but interactive
        this.gameBoard.interactive = true;
        this.addChild(this.gameBoard);
        
        // Score display (upper-left) using dedicated sprite
        this.scoreDisplay = new ScoreDisplaySprite({ width: 180, height: 44, fontSize: 40, textColor: 0x60a5fa });
        this.scoreDisplay.position.set(12, 12);
        this.addChild(this.scoreDisplay);
                
        // Compute dynamic danger Y just below score (fallback to config)
        const belowScoreY = (this.scoreDisplay?.position.y || 0) + this.scoreUiHeight + 8;
        // Use whichever is lower on the screen (greater Y) to ensure it's under the UI
        this.dangerY = Math.max(belowScoreY, GAME_CONFIG.dangerLineY);

        // Create the danger line (hidden by default)
        this.dangerLine = new PixiGraphics();
        this.drawDangerLine(false);
        this.addChild(this.dangerLine);
        
        // Floor rectangle
        const floorThickness = 20;
        const floorY = this.gameHeight - floorThickness / 2;
        this.floorRect = new PixiGraphics();
        this.floorRect.rect(0, floorY - floorThickness / 2, this.gameWidth, floorThickness);
        this.floorRect.fill({ color: 0x8B4513 }); // Brown color for floor
        this.addChild(this.floorRect);
        
        // Ghost piece for aiming (positioned at top center)
        this.ghostPiece = createPieceSprite(this.spawner.getCurrentTier());
        this.ghostPiece.alpha = 0.5;
        this.ghostPiece.position.set(this.gameWidth / 2, 40);
        this.addChild(this.ghostPiece);
    }
    
    private setupInput(): void {
        this.gameBoard.on('pointerdown', this.onPointerDown.bind(this));
    }
    
    private onPointerDown(event: any): void {
        if (this.isGameOver) return;
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
        // Suppress danger line briefly after each turn start
        this.dangerSuppressUntil = Date.now() + GAME_CONFIG.dangerSuppressMs;
        
        // Create physics piece at the target position
        const dropY = 60; // Drop from near the top
        this.physicsWorld.createPiece(tier, dropX, dropY);
        
        // Update ghost piece to show next piece
        this.updateGhostPiece();

        // After a turn advances, check if any tracked danger pieces exceeded limit
        this.checkDangerTurns();
        
        // Small delay before allowing next drop
        setTimeout(() => {
            this.isDropping = false;
        }, 200);
    }

    private drawDangerLine(visible: boolean): void {
        this.dangerLine.clear?.();
        // Draw a thin red line across the board at dangerY
        this.dangerLine.rect(0, this.dangerY - 1, this.gameWidth, 2);
        this.dangerLine.fill({ color: 0xff4d4d });
        this.dangerLine.alpha = visible ? 1 : 0;
    }
    
    private updateGhostPiece(): void {
        const currentTier = this.spawner.getCurrentTier();
        this.removeChild(this.ghostPiece);
        this.ghostPiece = createPieceSprite(currentTier);
        this.ghostPiece.alpha = 0.5;
        this.ghostPiece.position.set(this.gameWidth / 2, 40); // Keep centered
        this.addChild(this.ghostPiece);
    }
    
    private attachPieceSprite(piece: GamePiece): void {
        const sprite = createPieceSprite(piece.tier);
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
    
    private handleMergeComplete(newPiece: GamePiece, mergedTier: TierConfig, score: number, _multiplier: number): void {
        this.score += score;
        this.updateScoreDisplay();
        AudioManager.playMerge(mergedTier.id);
        
        this.spawnMergeEffect(newPiece, mergedTier);
    }

    private spawnMergeEffect(newPiece: GamePiece, previousTier: TierConfig): void {
        const targetRadius = Math.max(previousTier.radius, newPiece.tier.radius);
        const effect = createCloudTransformEffect(targetRadius * 2);
        if (!effect) {
            return;
        }

        effect.position.set(newPiece.body.position.x, newPiece.body.position.y);
        effect.onComplete = () => {
            this.removeChild(effect);
            this.mergeEffects = this.mergeEffects.filter((entry) => entry !== effect);
            effect.destroy();
        };

        this.addChild(effect);
        this.mergeEffects.push(effect);
    }
    
    private updateScoreDisplay(): void {
        if (this.scoreDisplay && typeof this.scoreDisplay.setScore === 'function') {
            this.scoreDisplay.setScore(this.score);
        }
    }
    
    private updateComboDisplay(count: number, _multiplier: number): void {
        // Spawn a floating, red combo notification on the right side
        if (count > 1) {
            AudioManager.playCombo(count);
            this.spawnComboNotification(count, _multiplier);
        }
    }

    private spawnComboNotification(count: number, _multiplier: number): void {
        const text = new PixiText({
            text: `Combo x${count}`,
            style: {
                fontFamily: 'Arial',
                fontSize: 22,
                fill: 0xff0000, // red
                fontWeight: '900',
                align: 'right',
                stroke: { color: 0x000000, width: 2 },
                dropShadow: {
                    color: 0x000000,
                    blur: 1,
                    distance: 1,
                    angle: Math.PI / 3,
                    alpha: 1
                }
            }
        });
        // Right-align anchor so it hugs the right edge
        text.anchor.set(1, 0);
        // Start near the top-right; a bit below the top UI
        const startX = this.gameWidth - 12;
        const startY = 80;
        text.position.set(startX, startY);
        this.addChild(text);

        // Up-left gentle drift to keep on-screen
        const vx = -40;  // leftward
        const vy = -60;  // upward
        const life = 1.5; // seconds
        this.comboNotifications.push({ node: text, vx, vy, life, initialLife: life });
        // debug output removed
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

    private updateDangerState(): void {
        // Determine which pieces are in the danger zone (any part across the line)
        const pieces = this.physicsWorld.getAllPieces();
        const inZone: Set<string> = new Set();
        for (const piece of pieces) {
            const topY = piece.body.position.y - piece.tier.radius;
            if (topY <= this.dangerY) {
                inZone.add(piece.id);
                if (!this.inDangerByPiece.has(piece.id)) {
                    // Start counting only after suppression window ends
                    if (Date.now() >= this.dangerSuppressUntil) {
                        this.inDangerByPiece.set(piece.id, this.spawner.getTurnCount());
                    }
                }
            }
        }
        // Remove entries for pieces that left the zone entirely or were removed
        for (const key of Array.from(this.inDangerByPiece.keys())) {
            if (!inZone.has(key)) {
                this.inDangerByPiece.delete(key);
            }
        }
        // Toggle danger line visibility
        const anyTracked = this.inDangerByPiece.size > 0;
        const suppressionElapsed = Date.now() >= this.dangerSuppressUntil;
        const show = anyTracked || (suppressionElapsed && inZone.size > 0);
        if (!this.isDangerActive && show && suppressionElapsed) {
            AudioManager.playDanger();
        }
        this.isDangerActive = show;
        this.drawDangerLine(show);
    }

    private checkDangerTurns(): void {
        if (this.isGameOver) return;
        const currentTurn = this.spawner.getTurnCount();
        for (const [pieceId, enteredTurn] of this.inDangerByPiece) {
            if (currentTurn - enteredTurn >= GAME_CONFIG.dangerTurnLimit) {
                // Confirm the piece is still in danger at the moment of checking
                const piece = this.physicsWorld.getPiece(pieceId);
                if (piece) {
                    const topY = piece.body.position.y - piece.tier.radius;
                    if (topY <= this.dangerY) {
                        this.endGame();
                        return;
                    } else {
                        this.inDangerByPiece.delete(pieceId);
                    }
                } else {
                    this.inDangerByPiece.delete(pieceId);
                }
            }
        }
    }

    private endGame(): void {
        if (this.isGameOver) return;
        this.isGameOver = true;
        AudioManager.playGameOver();
        // Pause physics
        this.physicsWorld.pause();
        // Disable interactions
        this.gameBoard.interactive = false;
        // Show overlay
        this.gameOverOverlay = new GameOverOverlayComponent({
            width: this.gameWidth,
            height: this.gameHeight,
            score: this.score,
            onRestart: () => {
                Manager.changeScene(new GameScene());
            },
            onSubmitScore: this.handleScoreSubmission,
            onSubmissionSuccess: (result, payload) => {
                this.handleSubmissionSuccess(result, payload);
            }
        });
        this.addChild(this.gameOverOverlay);
    }

    update(framesPassed: number): void {
        if (this.isGameOver) {
            return;
        }
        // Update game systems
        this.physicsWorld.update(framesPassed);
        this.mergeSystem.update(framesPassed);
        
        // Sync visual sprites with physics
        this.syncPhysicsToSprites();
        // Update danger tracking and UI each tick
        this.updateDangerState();
        
        // Animate floating combo notifications
        if (this.comboNotifications.length) {
            // Convert frames to seconds (60fps base) with robust numeric fallback
            const rawFrames = Number(framesPassed);
            const safeFrames = Number.isFinite(rawFrames) ? rawFrames : 1;
            const dt = Math.min(Math.max(safeFrames, 0), 5) / 60;
            for (let i = this.comboNotifications.length - 1; i >= 0; i--) {
                const n = this.comboNotifications[i];
                n.node.position.x += n.vx * dt;
                n.node.position.y += n.vy * dt;
                n.life -= dt;
                n.node.alpha = Math.max(0, n.life / n.initialLife);
                // Guard against invalid positions
                if (!Number.isFinite(n.node.position.x) || !Number.isFinite(n.node.position.y)) {
                    this.removeChild(n.node);
                    this.comboNotifications.splice(i, 1);
                    continue;
                }
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
            // no debug overlay
        }
        
        // Game over handled via turn-based checks on drop
    }

    resize(parentWidth: number, parentHeight: number): void {
        const safeParentWidth = Math.max(1, parentWidth);
        const safeParentHeight = Math.max(1, parentHeight);

        // Fit the game to the container bounds
        const scaleX = safeParentWidth / this.gameWidth;
        const scaleY = safeParentHeight / this.gameHeight;
        const scale = Math.min(1, scaleX, scaleY);
        const safeScale = Number.isFinite(scale) && scale > 0 ? scale : 1;
        
        this.scale.set(safeScale);

        const scaledWidth = this.gameWidth * safeScale;
        const scaledHeight = this.gameHeight * safeScale;
        const offsetX = (safeParentWidth - scaledWidth) / 2;
        const offsetY = Math.max(0, (safeParentHeight - scaledHeight) / 2);

        this.position.set(offsetX, offsetY);
    }
    
    destroy(): void {
        // Clean up physics world
        if (this.physicsWorld) {
            this.physicsWorld.destroy();
        }
        
        // Clean up sprites
        this.pieceSprites.clear();
        for (const effect of this.mergeEffects) {
            effect.destroy();
        }
        this.mergeEffects = [];
        if (this.gameOverOverlay) {
            this.removeChild(this.gameOverOverlay);
            this.gameOverOverlay.destroy();
            this.gameOverOverlay = undefined;
        }

        super.destroy();
    }

    private handleSubmissionSuccess(_result: ScoreSubmissionResult, payload: ScoreSubmissionPayload): void {
        const leaderboard = getLeaderboardPanel();
        if (!leaderboard) {
            return;
        }
        leaderboard.setHighlightNickname(payload.nickname);
        leaderboard.refresh().catch((error) => {
            console.error('Failed to refresh leaderboard', error);
        });
    }
}
