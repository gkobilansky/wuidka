import { PixiContainer, PixiSprite, PixiText, PixiGraphics, PixiAnimatedSprite } from "../../plugins/engine";
import { ScoreDisplaySprite } from "../sprites";
import { Manager, SceneInterface } from "../../entities/manager";
import { PhysicsWorld, GamePiece } from "../../systems/physics-world";
import { Spawner } from "../../systems/spawner";
import { MergeSystem, type BigStonerClearEvent } from "../../systems/merge-system";
import { GAME_CONFIG, TierConfig } from "../../shared/config/game-config";
import { createPieceSprite, setPieceSpriteMovementState } from "../utils/piece-sprite";
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
    private bigStonerShockwaves: { node: PixiGraphics; life: number; initialLife: number; minScale: number; maxScale: number }[] = [];
    private bigStonerCallouts: { node: PixiText; life: number; initialLife: number }[] = [];
    private screenFlashes: { node: PixiGraphics; life: number; initialLife: number }[] = [];
    private pieceMotionState: Map<string, boolean> = new Map();
    private readonly motionVerticalThreshold: number = 0.35;
    private readonly motionSpeedThreshold: number = 0.55;
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
        this.mergeSystem.onBigStonerClear = (event) => {
            this.handleBigStonerClear(event);
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
        this.dangerY = Math.min(belowScoreY, GAME_CONFIG.dangerLineY);

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
        this.applyPieceMotionState(piece, sprite);
    }
    
    private removePieceSprite(piece: GamePiece): void {
        const sprite = this.pieceSprites.get(piece.id);
        if (sprite) {
            this.removeChild(sprite);
            this.pieceSprites.delete(piece.id);
        }
        this.pieceMotionState.delete(piece.id);
    }
    
    private handleMergeComplete(newPiece: GamePiece, mergedTier: TierConfig, score: number, _multiplier: number): void {
        this.score += score;
        this.updateScoreDisplay();
        AudioManager.playMerge(mergedTier.id);
        
        this.spawnMergeEffect(newPiece, mergedTier);
    }

    private handleBigStonerClear(event: BigStonerClearEvent): void {
        this.score += event.score;
        this.updateScoreDisplay();
        AudioManager.playMerge(event.tier.id);
        AudioManager.playBigStonerBlast();

        this.spawnScreenFlash(0xfff4cf, 0.35);
        this.spawnBigStonerClearEffect(event.position, event.tier);
        this.spawnBigStonerCallout(event.position, event.tier, event.score, event.comboMultiplier);
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

    private spawnBigStonerClearEffect(position: { x: number; y: number }, tier: TierConfig): void {
        const targetDiameter = tier.radius * 2 * 2.2;
        const effect = createCloudTransformEffect(targetDiameter);
        if (effect) {
            effect.position.set(position.x, position.y);
            effect.animationSpeed = 0.45;
            effect.alpha = 0.95;
            effect.tint = 0xfff2c0;
            effect.onComplete = () => {
                this.removeChild(effect);
                this.mergeEffects = this.mergeEffects.filter((entry) => entry !== effect);
                effect.destroy();
            };
            this.addChild(effect);
            this.mergeEffects.push(effect);
        }

        const outerWave = new PixiGraphics();
        outerWave.position.set(position.x, position.y);
        outerWave.circle(0, 0, tier.radius * 1.2);
        outerWave.stroke({ color: 0xfff8d1, width: 10, alpha: 1 });
        outerWave.fill({ color: 0xffe5a7, alpha: 0.18 });
        outerWave.scale.set(0.35);
        this.addChild(outerWave);
        this.trackBigStonerShockwave(outerWave, 0.9, 0.35, 2.8);

        const innerBurst = new PixiGraphics();
        innerBurst.position.set(position.x, position.y);
        innerBurst.circle(0, 0, tier.radius * 0.65);
        innerBurst.fill({ color: 0xffffff, alpha: 0.95 });
        innerBurst.scale.set(0.1);
        this.addChild(innerBurst);
        this.trackBigStonerShockwave(innerBurst, 0.4, 0.1, 1.6);
    }

    private trackBigStonerShockwave(node: PixiGraphics, duration: number, minScale: number, maxScale: number): void {
        this.bigStonerShockwaves.push({
            node,
            life: duration,
            initialLife: duration,
            minScale,
            maxScale
        });
    }

    private spawnBigStonerCallout(position: { x: number; y: number }, tier: TierConfig, score: number, comboMultiplier: number): void {
        const multiplierSuffix = comboMultiplier > 1 ? ` (x${comboMultiplier.toFixed(1)} combo)` : '';
        const text = new PixiText({
            text: `STONER BLAST\n+${score}${multiplierSuffix}`,
            style: {
                fontFamily: 'Arial Black',
                fontSize: 40,
                fill: 0xfff3b0,
                fontWeight: '900',
                align: 'center',
                stroke: { color: 0x8b5cf6, width: 6 },
                dropShadow: {
                    color: 0x1f2937,
                    blur: 3,
                    distance: 3,
                    angle: Math.PI / 2,
                    alpha: 0.85
                },
                letterSpacing: 1
            }
        });
        text.anchor.set(0.5);
        const targetY = Math.max(120, position.y - tier.radius - 50);
        text.position.set(this.gameWidth / 2, targetY);
        this.addChild(text);
        this.bigStonerCallouts.push({
            node: text,
            life: 1.6,
            initialLife: 1.6
        });
    }

    private spawnScreenFlash(color: number, duration: number = 0.3): void {
        const overlay = new PixiGraphics();
        overlay.rect(0, 0, this.gameWidth, this.gameHeight);
        overlay.fill({ color, alpha: 0.35 });
        overlay.alpha = 0.85;
        overlay.interactive = false;
        this.addChild(overlay);
        this.screenFlashes.push({
            node: overlay,
            life: duration,
            initialLife: duration
        });
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
                this.applyPieceMotionState(piece, sprite);
            }
        }
    }

    private applyPieceMotionState(piece: GamePiece, sprite: PixiSprite): void {
        const isMoving = this.isPieceInMotion(piece);
        const previous = this.pieceMotionState.get(piece.id);
        if (previous === isMoving) {
            return;
        }
        this.pieceMotionState.set(piece.id, isMoving);
        setPieceSpriteMovementState(sprite, isMoving);
    }

    private isPieceInMotion(piece: GamePiece): boolean {
        const vy = piece.body.velocity?.y ?? 0;
        const bodySpeed = typeof piece.body.speed === 'number'
            ? piece.body.speed
            : Math.hypot(piece.body.velocity?.x ?? 0, vy);

        if (!Number.isFinite(vy) && !Number.isFinite(bodySpeed)) {
            return false;
        }

        if (Math.abs(vy) > this.motionVerticalThreshold) {
            return true;
        }

        return bodySpeed > this.motionSpeedThreshold;
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
        
        const dt = this.computeDeltaSeconds(framesPassed);

        // Animate floating combo notifications
        if (this.comboNotifications.length) {
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
        }

        if (this.bigStonerCallouts.length) {
            for (let i = this.bigStonerCallouts.length - 1; i >= 0; i--) {
                const entry = this.bigStonerCallouts[i];
                entry.life -= dt;
                entry.node.position.y -= 25 * dt;
                const progress = 1 - entry.life / entry.initialLife;
                const eased = 1 - Math.pow(1 - Math.max(0, Math.min(1, progress)), 3);
                entry.node.alpha = Math.max(0, 1 - eased);
                entry.node.scale.set(1 + 0.25 * Math.sin(eased * Math.PI));
                if (entry.life <= 0) {
                    this.removeChild(entry.node);
                    entry.node.destroy();
                    this.bigStonerCallouts.splice(i, 1);
                }
            }
        }

        if (this.bigStonerShockwaves.length) {
            for (let i = this.bigStonerShockwaves.length - 1; i >= 0; i--) {
                const wave = this.bigStonerShockwaves[i];
                wave.life -= dt;
                const progress = 1 - wave.life / wave.initialLife;
                const eased = 1 - Math.pow(1 - Math.max(0, Math.min(1, progress)), 2);
                const scale = wave.minScale + (wave.maxScale - wave.minScale) * eased;
                wave.node.scale.set(scale);
                wave.node.alpha = Math.max(0, 0.9 * (1 - eased));
                if (wave.life <= 0) {
                    this.removeChild(wave.node);
                    wave.node.destroy();
                    this.bigStonerShockwaves.splice(i, 1);
                }
            }
        }

        if (this.screenFlashes.length) {
            for (let i = this.screenFlashes.length - 1; i >= 0; i--) {
                const flash = this.screenFlashes[i];
                flash.life -= dt;
                flash.node.alpha = Math.max(0, flash.life / flash.initialLife);
                if (flash.life <= 0) {
                    this.removeChild(flash.node);
                    flash.node.destroy();
                    this.screenFlashes.splice(i, 1);
                }
            }
        }

        // Game over handled via turn-based checks on drop
    }

    private computeDeltaSeconds(framesPassed: number): number {
        const rawFrames = Number(framesPassed);
        const safeFrames = Number.isFinite(rawFrames) ? rawFrames : 1;
        const clampedFrames = Math.min(Math.max(safeFrames, 0), 5);
        return clampedFrames / 60;
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
        this.pieceMotionState.clear();
        for (const effect of this.mergeEffects) {
            effect.destroy();
        }
        this.mergeEffects = [];
        for (const wave of this.bigStonerShockwaves) {
            this.removeChild(wave.node);
            wave.node.destroy();
        }
        this.bigStonerShockwaves = [];
        for (const callout of this.bigStonerCallouts) {
            this.removeChild(callout.node);
            callout.node.destroy();
        }
        this.bigStonerCallouts = [];
        for (const flash of this.screenFlashes) {
            this.removeChild(flash.node);
            flash.node.destroy();
        }
        this.screenFlashes = [];
        if (this.gameOverOverlay) {
            this.removeChild(this.gameOverOverlay);
            this.gameOverOverlay.destroy();
            this.gameOverOverlay = undefined;
        }

        super.destroy();
    }

    private handleSubmissionSuccess(result: ScoreSubmissionResult, payload: ScoreSubmissionPayload): void {
        const leaderboard = getLeaderboardPanel();
        if (!leaderboard) {
            return;
        }
        leaderboard.setHighlightUserId(result.entry.userId ?? null);
        leaderboard.setHighlightNickname(payload.nickname);
        leaderboard.refresh().catch((error) => {
            console.error('Failed to refresh leaderboard', error);
        });
    }
}
