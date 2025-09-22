import { GamePiece, PhysicsWorld } from './physics-world';
import { GAME_CONFIG, getNextTier, canMerge, TierConfig } from '../shared/config/game-config';
import { Body } from 'matter-js';

interface MergeCandidate {
  piece1: GamePiece;
  piece2: GamePiece;
  timestamp: number;
  confirmed: boolean;
}

interface ComboState {
  count: number;
  lastMergeTime: number;
  multiplier: number;
}

export class MergeSystem {
  private physicsWorld: PhysicsWorld;
  private mergeCandidates: Map<string, MergeCandidate> = new Map();
  private comboState: ComboState = { count: 0, lastMergeTime: 0, multiplier: 1.0 };

  // Callbacks
  public onMergeComplete?: (newPiece: GamePiece, mergedTier: TierConfig, score: number, comboMultiplier: number) => void;
  public onComboUpdate?: (comboCount: number, multiplier: number) => void;

  constructor(physicsWorld: PhysicsWorld) {
    this.physicsWorld = physicsWorld;
    
    // Set up collision handling
    this.physicsWorld.onCollisionStart = (piece1, piece2) => {
      this.handleCollision(piece1, piece2);
    };
  }

  private handleCollision(piece1: GamePiece, piece2: GamePiece): void {
    // Only consider pieces of the same tier
    if (piece1.tier.id !== piece2.tier.id) return;
    
    // Don't merge pieces that are already capped (tier 12)
    if (!canMerge(piece1.tier.id)) return;
    
    console.log(`Collision detected: ${piece1.tier.name} (${piece1.id}) + ${piece2.tier.name} (${piece2.id})`);
    
    // Create a unique key for this collision pair
    const key = this.createCollisionKey(piece1.id, piece2.id);
    
    // If we already have a candidate for this pair, skip
    if (this.mergeCandidates.has(key)) return;
    
    // Immediately make same-tier pieces stick together by reducing their velocity and restitution
    this.makeSticky(piece1, piece2);
    
    // Create new merge candidate
    const candidate: MergeCandidate = {
      piece1,
      piece2,
      timestamp: Date.now(),
      confirmed: false
    };
    
    this.mergeCandidates.set(key, candidate);
    console.log(`Merge candidate created for ${piece1.tier.name} pieces, waiting ${GAME_CONFIG.mergeRestMs}ms...`);
  }

  private createCollisionKey(id1: string, id2: string): string {
    // Create consistent key regardless of order
    return id1 < id2 ? `${id1}-${id2}` : `${id2}-${id1}`;
  }

  private makeSticky(piece1: GamePiece, piece2: GamePiece): void {
    // Drastically reduce velocity to prevent bouncing
    const dampingFactor = 0.1; // Keep only 10% of velocity
    
    Body.setVelocity(piece1.body, {
      x: piece1.body.velocity.x * dampingFactor,
      y: piece1.body.velocity.y * dampingFactor
    });
    
    Body.setVelocity(piece2.body, {
      x: piece2.body.velocity.x * dampingFactor,
      y: piece2.body.velocity.y * dampingFactor
    });
    
    // Temporarily reduce restitution (bounciness) to near zero
    piece1.body.restitution = 0.01;
    piece2.body.restitution = 0.01;
    
    // Increase friction to make them stick together
    piece1.body.friction = 0.9;
    piece2.body.friction = 0.9;
    
    console.log(`Made pieces sticky: ${piece1.tier.name} pieces should now stick together`);
  }

  public update(_deltaTime: number): void {
    const now = Date.now();
    const candidatesToProcess: string[] = [];
    const candidatesToRemove: string[] = [];

    // Check all merge candidates
    for (const [key, candidate] of this.mergeCandidates) {
      // Check if pieces still exist
      if (!this.physicsWorld.getPiece(candidate.piece1.id) || 
          !this.physicsWorld.getPiece(candidate.piece2.id)) {
        candidatesToRemove.push(key);
        continue;
      }

      // Apply magnetic attraction between same-tier pieces
      this.applyMagneticAttraction(candidate.piece1, candidate.piece2);

      const timeWaiting = now - candidate.timestamp;
      
      if (timeWaiting >= GAME_CONFIG.mergeRestMs && !candidate.confirmed) {
        // Check if pieces are still close enough and moving slowly
        if (this.canConfirmMerge(candidate.piece1, candidate.piece2)) {
          console.log(`Merge confirmed for ${candidate.piece1.tier.name} pieces after ${timeWaiting}ms`);
          candidate.confirmed = true;
          candidatesToProcess.push(key);
        } else {
          // Conditions no longer met, remove candidate
          console.log(`Merge cancelled for ${candidate.piece1.tier.name} pieces - conditions not met`);
          candidatesToRemove.push(key);
        }
      }
    }

    // Process confirmed merges
    for (const key of candidatesToProcess) {
      const candidate = this.mergeCandidates.get(key);
      if (candidate) {
        this.executeMerge(candidate);
        candidatesToRemove.push(key);
      }
    }

    // Clean up processed/invalid candidates
    for (const key of candidatesToRemove) {
      this.mergeCandidates.delete(key);
    }

    // Update combo state
    this.updateComboState(now);
  }

  private applyMagneticAttraction(piece1: GamePiece, piece2: GamePiece): void {
    const body1 = piece1.body;
    const body2 = piece2.body;
    
    // Calculate distance between pieces
    const dx = body2.position.x - body1.position.x;
    const dy = body2.position.y - body1.position.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    // Only apply attraction if pieces are close (within 2x radius)
    const maxAttractionDistance = (piece1.tier.radius + piece2.tier.radius) * 2;
    if (distance > maxAttractionDistance || distance < 0.1) return;
    
    // Normalize direction vector
    const dirX = dx / distance;
    const dirY = dy / distance;
    
    // Calculate attraction force (stronger when closer)
    const attractionStrength = 0.002; // Adjust this value to control attraction strength
    const force = attractionStrength * (1 / Math.max(distance, 1)); // Inverse distance, with minimum
    
    // Apply force to both bodies (opposite directions)
    const forceX = dirX * force;
    const forceY = dirY * force;
    
    // Apply forces using Matter.js Body.applyForce
    Body.applyForce(body1, body1.position, { x: forceX, y: forceY });
    Body.applyForce(body2, body2.position, { x: -forceX, y: -forceY });
  }

  private canConfirmMerge(piece1: GamePiece, piece2: GamePiece): boolean {
    // Since we made pieces sticky on collision, they should always be ready to merge
    // Just check they still exist and are reasonably close
    const dx = piece1.body.position.x - piece2.body.position.x;
    const dy = piece1.body.position.y - piece2.body.position.y;
    const distance = Math.sqrt(dx ** 2 + dy ** 2);
    const maxDistance = (piece1.tier.radius + piece2.tier.radius) * 1.5; // Allow generous distance

    if (distance > maxDistance) {
      console.log(`Merge failed - pieces too far apart: ${distance.toFixed(2)} (max: ${maxDistance.toFixed(2)})`);
      return false;
    }

    console.log(`Merge ready - distance: ${distance.toFixed(2)} (max: ${maxDistance.toFixed(2)})`);
    return true;
  }

  private executeMerge(candidate: MergeCandidate): void {
    const { piece1, piece2 } = candidate;
    
    // Get the next tier
    const nextTier = getNextTier(piece1.tier.id);
    if (!nextTier) return; // Shouldn't happen due to canMerge check
    
    // Calculate merge position (average of the two pieces)
    const mergeX = (piece1.body.position.x + piece2.body.position.x) / 2;
    const mergeY = (piece1.body.position.y + piece2.body.position.y) / 2;
    
    console.log(`Executing merge: ${piece1.tier.name} → ${nextTier.name} at (${Math.round(mergeX)}, ${Math.round(mergeY)})`);
    
    // Remove the old pieces
    this.physicsWorld.removePiece(piece1.id);
    this.physicsWorld.removePiece(piece2.id);
    
    // Create new merged piece
    const newPiece = this.physicsWorld.createPiece(nextTier, mergeX, mergeY);
    
    // Update combo state
    this.incrementCombo();
    
    // Calculate score with combo multiplier
    const baseScore = piece1.tier.points; // Score is based on the merged tier
    const finalScore = Math.floor(baseScore * this.comboState.multiplier);
    
    // Trigger callback
    if (this.onMergeComplete) {
      this.onMergeComplete(newPiece, piece1.tier, finalScore, this.comboState.multiplier);
    }
  }

  private incrementCombo(): void {
    const now = Date.now();
    
    // If we're within the combo window, increment
    if (now - this.comboState.lastMergeTime < GAME_CONFIG.comboWindowMs) {
      this.comboState.count++;
    } else {
      // Start new combo
      this.comboState.count = 1;
    }
    
    this.comboState.lastMergeTime = now;
    
    // Calculate multiplier (10% per combo, cap at 50%)
    this.comboState.multiplier = 1.0 + Math.min(0.5, (this.comboState.count - 1) * 0.1);
    
    // Trigger callback
    if (this.onComboUpdate) {
      this.onComboUpdate(this.comboState.count, this.comboState.multiplier);
    }
  }

  private updateComboState(now: number): void {
    // Reset combo if window has expired
    if (now - this.comboState.lastMergeTime > GAME_CONFIG.comboWindowMs) {
      if (this.comboState.count > 0) {
        this.comboState.count = 0;
        this.comboState.multiplier = 1.0;
        
        // Trigger callback for combo end
        if (this.onComboUpdate) {
          this.onComboUpdate(0, 1.0);
        }
      }
    }
  }

  public getCurrentCombo(): { count: number; multiplier: number } {
    return {
      count: this.comboState.count,
      multiplier: this.comboState.multiplier
    };
  }

  public getMergeCandidateCount(): number {
    return this.mergeCandidates.size;
  }

  public reset(): void {
    this.mergeCandidates.clear();
    this.comboState = { count: 0, lastMergeTime: 0, multiplier: 1.0 };
  }
}
