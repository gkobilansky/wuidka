import { GamePiece, PhysicsWorld } from './physics-world';
import { GAME_CONFIG, getNextTier, canMerge, TierConfig } from '../shared/config/game-config';

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
    
    // Create a unique key for this collision pair
    const key = this.createCollisionKey(piece1.id, piece2.id);
    
    // If we already have a candidate for this pair, skip
    if (this.mergeCandidates.has(key)) return;
    
    // Create new merge candidate
    const candidate: MergeCandidate = {
      piece1,
      piece2,
      timestamp: Date.now(),
      confirmed: false
    };
    
    this.mergeCandidates.set(key, candidate);
  }

  private createCollisionKey(id1: string, id2: string): string {
    // Create consistent key regardless of order
    return id1 < id2 ? `${id1}-${id2}` : `${id2}-${id1}`;
  }

  public update(deltaTime: number): void {
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

      const timeWaiting = now - candidate.timestamp;
      
      if (timeWaiting >= GAME_CONFIG.mergeRestMs && !candidate.confirmed) {
        // Check if pieces are still close enough and moving slowly
        if (this.canConfirmMerge(candidate.piece1, candidate.piece2)) {
          candidate.confirmed = true;
          candidatesToProcess.push(key);
        } else {
          // Conditions no longer met, remove candidate
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

  private canConfirmMerge(piece1: GamePiece, piece2: GamePiece): boolean {
    const body1 = piece1.body;
    const body2 = piece2.body;

    // Check velocity threshold - pieces should be relatively at rest
    const velocityThreshold = 0.5;
    const velocity1 = Math.sqrt(body1.velocity.x ** 2 + body1.velocity.y ** 2);
    const velocity2 = Math.sqrt(body2.velocity.x ** 2 + body2.velocity.y ** 2);
    
    if (velocity1 > velocityThreshold || velocity2 > velocityThreshold) {
      return false;
    }

    // Check distance - pieces should be overlapping
    const dx = body1.position.x - body2.position.x;
    const dy = body1.position.y - body2.position.y;
    const distance = Math.sqrt(dx ** 2 + dy ** 2);
    const minDistance = (piece1.tier.radius + piece2.tier.radius) * 0.8; // 80% overlap required

    return distance < minDistance;
  }

  private executeMerge(candidate: MergeCandidate): void {
    const { piece1, piece2 } = candidate;
    
    // Get the next tier
    const nextTier = getNextTier(piece1.tier.id);
    if (!nextTier) return; // Shouldn't happen due to canMerge check
    
    // Calculate merge position (average of the two pieces)
    const mergeX = (piece1.body.position.x + piece2.body.position.x) / 2;
    const mergeY = (piece1.body.position.y + piece2.body.position.y) / 2;
    
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