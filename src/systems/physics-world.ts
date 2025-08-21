import { Engine, World, Bodies, Body, Events, Render, Runner } from 'matter-js';
import { GAME_CONFIG, TierConfig } from '../shared/config/game-config';

export interface GamePiece {
  id: string;
  body: Body;
  tier: TierConfig;
  sprite?: any; // PixiJS sprite reference
}

export class PhysicsWorld {
  private engine: Engine;
  private world: World;
  private render?: Render;
  private runner: Runner;
  private pieces: Map<string, GamePiece> = new Map();
  private wallLeft: Body;
  private wallRight: Body;
  private floor: Body;
  private pieceIdCounter = 0;

  // Callbacks
  public onCollisionStart?: (piece1: GamePiece, piece2: GamePiece) => void;
  public onPieceCreated?: (piece: GamePiece) => void;
  public onPieceRemoved?: (piece: GamePiece) => void;

  constructor(worldWidth: number, worldHeight: number, enableDebug = false) {
    // Create engine
    this.engine = Engine.create();
    this.world = this.engine.world;
    
    // Configure physics settings from game config
    this.engine.world.gravity.y = GAME_CONFIG.gravity;
    
    // Create boundaries
    const wallThickness = 20;
    
    // Left wall
    this.wallLeft = Bodies.rectangle(
      -wallThickness / 2, 
      worldHeight / 2, 
      wallThickness, 
      worldHeight,
      { isStatic: true, label: 'wall-left' }
    );
    
    // Right wall
    this.wallRight = Bodies.rectangle(
      worldWidth + wallThickness / 2, 
      worldHeight / 2, 
      wallThickness, 
      worldHeight,
      { isStatic: true, label: 'wall-right' }
    );
    
    // Floor
    this.floor = Bodies.rectangle(
      worldWidth / 2, 
      worldHeight - wallThickness / 2, 
      worldWidth + wallThickness * 2, 
      wallThickness,
      { isStatic: true, label: 'floor' }
    );
    
    // Add boundaries to world
    World.add(this.world, [this.wallLeft, this.wallRight, this.floor]);
    
    // Set up collision detection
    Events.on(this.engine, 'collisionStart', (event) => {
      this.handleCollisionStart(event);
    });
    
    // Create runner for fixed timestep
    this.runner = Runner.create();
    Runner.run(this.runner, this.engine);
    
    // Debug rendering if enabled
    if (enableDebug && typeof window !== 'undefined') {
      this.setupDebugRender(worldWidth, worldHeight);
    }
  }

  private setupDebugRender(worldWidth: number, worldHeight: number): void {
    const canvas = document.createElement('canvas');
    canvas.style.position = 'absolute';
    canvas.style.top = '0';
    canvas.style.left = '0';
    canvas.style.zIndex = '1000';
    canvas.style.pointerEvents = 'none';
    document.body.appendChild(canvas);
    
    this.render = Render.create({
      canvas: canvas,
      engine: this.engine,
      options: {
        width: worldWidth,
        height: worldHeight,
        wireframes: false,
        background: 'transparent'
      }
    });
    
    Render.run(this.render);
  }

  private handleCollisionStart(event: any): void {
    const pairs = event.pairs;
    
    for (const pair of pairs) {
      const { bodyA, bodyB } = pair;
      
      // Skip if either body is a boundary
      if (this.isBoundary(bodyA) || this.isBoundary(bodyB)) continue;
      
      const pieceA = this.getPieceByBodyId(bodyA.id);
      const pieceB = this.getPieceByBodyId(bodyB.id);
      
      if (pieceA && pieceB && this.onCollisionStart) {
        this.onCollisionStart(pieceA, pieceB);
      }
    }
  }

  private isBoundary(body: Body): boolean {
    return body.label.startsWith('wall-') || body.label === 'floor';
  }

  private getPieceByBodyId(bodyId: number): GamePiece | undefined {
    for (const piece of this.pieces.values()) {
      if (piece.body.id === bodyId) {
        return piece;
      }
    }
    return undefined;
  }

  public createPiece(tier: TierConfig, x: number, y: number): GamePiece {
    const pieceId = `piece_${this.pieceIdCounter++}`;
    
    // Create circular body with tier-appropriate properties
    const body = Bodies.circle(x, y, tier.radius, {
      restitution: GAME_CONFIG.restitution,
      friction: GAME_CONFIG.friction,
      frictionAir: GAME_CONFIG.airFriction,
      density: this.calculateDensity(tier.radius),
      label: `piece-tier-${tier.id}`
    });
    
    const piece: GamePiece = {
      id: pieceId,
      body,
      tier
    };
    
    // Add to world and tracking
    World.add(this.world, body);
    this.pieces.set(pieceId, piece);
    
    // Trigger callback
    if (this.onPieceCreated) {
      this.onPieceCreated(piece);
    }
    
    return piece;
  }

  public removePiece(pieceId: string): void {
    const piece = this.pieces.get(pieceId);
    if (!piece) return;
    
    // Remove from world
    World.remove(this.world, piece.body);
    
    // Remove from tracking
    this.pieces.delete(pieceId);
    
    // Trigger callback
    if (this.onPieceRemoved) {
      this.onPieceRemoved(piece);
    }
  }

  public getPiece(pieceId: string): GamePiece | undefined {
    return this.pieces.get(pieceId);
  }

  public getAllPieces(): GamePiece[] {
    return Array.from(this.pieces.values());
  }

  public getPiecesAboveY(y: number): GamePiece[] {
    return this.getAllPieces().filter(piece => piece.body.position.y < y);
  }

  public getBodyCount(): number {
    return this.pieces.size;
  }

  private calculateDensity(radius: number): number {
    // Density should scale with radius to make larger pieces feel heavier
    // Base density with scaling factor
    return 0.001 * (radius / 20);
  }

  public update(deltaTime: number): void {
    // Matter.js handles the physics update automatically via Runner
    // This method can be used for custom logic if needed
    
    // Clean up bodies that might have fallen off screen or gone out of bounds
    this.cleanupOutOfBoundsPieces();
    
    // Enforce max body limit
    this.enforceBodyLimit();
  }

  private cleanupOutOfBoundsPieces(): void {
    const worldHeight = GAME_CONFIG.height;
    const piecesToRemove: string[] = [];
    
    for (const [pieceId, piece] of this.pieces) {
      // Remove pieces that have fallen way below the floor
      if (piece.body.position.y > worldHeight + 500) {
        piecesToRemove.push(pieceId);
      }
    }
    
    piecesToRemove.forEach(id => this.removePiece(id));
  }

  private enforceBodyLimit(): void {
    if (this.pieces.size <= GAME_CONFIG.maxBodies) return;
    
    // Remove oldest/smallest pieces first
    const sortedPieces = this.getAllPieces().sort((a, b) => {
      // Sort by tier (smaller first), then by creation time
      if (a.tier.id !== b.tier.id) {
        return a.tier.id - b.tier.id;
      }
      return a.body.id - b.body.id; // body.id increments with creation
    });
    
    const excess = this.pieces.size - GAME_CONFIG.maxBodies;
    for (let i = 0; i < excess; i++) {
      this.removePiece(sortedPieces[i].id);
    }
  }

  public destroy(): void {
    // Stop the runner
    Runner.stop(this.runner);
    
    // Clean up debug render if it exists
    if (this.render) {
      Render.stop(this.render);
      if (this.render.canvas && this.render.canvas.parentNode) {
        this.render.canvas.parentNode.removeChild(this.render.canvas);
      }
    }
    
    // Clear all pieces
    this.pieces.clear();
    
    // Clear the world
    World.clear(this.world, false);
  }
}