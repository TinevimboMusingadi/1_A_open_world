import { Entity } from './Entity.js';

/**
 * EntityManager class - Manages all entities in the game world
 * Provides efficient querying and management of entities and their components
 */
export class EntityManager {
  constructor() {
    this.entities = new Map(); // entityId -> Entity
    this.entityTags = new Map(); // tag -> Set<entityId>
    this.componentIndex = new Map(); // componentType -> Set<entityId>
    this.entitiesToDestroy = new Set(); // Entities marked for destruction
    
    // Performance tracking
    this.stats = {
      totalEntities: 0,
      activeEntities: 0,
      entitiesCreated: 0,
      entitiesDestroyed: 0
    };
  }

  /**
   * Create a new entity
   * @param {string} id - Optional custom ID
   * @returns {Entity} - The created entity
   */
  createEntity(id = null) {
    const entity = new Entity(id);
    this.addEntity(entity);
    return entity;
  }

  /**
   * Add an existing entity to the manager
   * @param {Entity} entity - Entity to add
   */
  addEntity(entity) {
    if (this.entities.has(entity.id)) {
      console.warn(`Entity with ID ${entity.id} already exists`);
      return;
    }

    this.entities.set(entity.id, entity);
    this.stats.totalEntities++;
    this.stats.entitiesCreated++;
    
    if (entity.isActive()) {
      this.stats.activeEntities++;
    }

    // Index entity tags
    this.indexEntityTags(entity);
    
    // Index entity components
    this.indexEntityComponents(entity);
  }

  /**
   * Remove an entity from the manager
   * @param {string} entityId - ID of entity to remove
   * @returns {boolean} - True if entity was removed
   */
  removeEntity(entityId) {
    const entity = this.entities.get(entityId);
    if (!entity) return false;

    // Remove from indices
    this.removeFromIndices(entity);
    
    // Destroy the entity
    entity.destroy();
    
    // Remove from main collection
    this.entities.delete(entityId);
    
    this.stats.totalEntities--;
    this.stats.entitiesDestroyed++;
    
    if (entity.isActive()) {
      this.stats.activeEntities--;
    }

    return true;
  }

  /**
   * Get entity by ID
   * @param {string} entityId - Entity ID
   * @returns {Entity|null} - The entity or null if not found
   */
  getEntity(entityId) {
    return this.entities.get(entityId) || null;
  }

  /**
   * Get all entities
   * @returns {Entity[]} - Array of all entities
   */
  getAllEntities() {
    return Array.from(this.entities.values());
  }

  /**
   * Get all active entities
   * @returns {Entity[]} - Array of active entities
   */
  getActiveEntities() {
    return Array.from(this.entities.values()).filter(entity => entity.isActive());
  }

  /**
   * Get entities with specific components
   * @param {string[]} componentTypes - Array of component type names
   * @returns {Entity[]} - Array of matching entities
   */
  getEntitiesWithComponents(componentTypes) {
    if (componentTypes.length === 0) {
      return this.getActiveEntities();
    }

    // Start with entities that have the first component
    let candidateIds = this.componentIndex.get(componentTypes[0]);
    if (!candidateIds) return [];

    // Intersect with entities that have each additional component
    for (let i = 1; i < componentTypes.length; i++) {
      const componentIds = this.componentIndex.get(componentTypes[i]);
      if (!componentIds) return [];
      
      candidateIds = new Set([...candidateIds].filter(id => componentIds.has(id)));
      
      if (candidateIds.size === 0) return [];
    }

    // Convert IDs to entities and filter for active ones
    return Array.from(candidateIds)
      .map(id => this.entities.get(id))
      .filter(entity => entity && entity.isActive());
  }

  /**
   * Get entities with any of the specified components
   * @param {string[]} componentTypes - Array of component type names
   * @returns {Entity[]} - Array of matching entities
   */
  getEntitiesWithAnyComponent(componentTypes) {
    const entityIds = new Set();
    
    for (const componentType of componentTypes) {
      const componentIds = this.componentIndex.get(componentType);
      if (componentIds) {
        componentIds.forEach(id => entityIds.add(id));
      }
    }

    return Array.from(entityIds)
      .map(id => this.entities.get(id))
      .filter(entity => entity && entity.isActive());
  }

  /**
   * Get entities by tag
   * @param {string} tag - Tag to search for
   * @returns {Entity[]} - Array of entities with the tag
   */
  getEntitiesByTag(tag) {
    const entityIds = this.entityTags.get(tag);
    if (!entityIds) return [];

    return Array.from(entityIds)
      .map(id => this.entities.get(id))
      .filter(entity => entity && entity.isActive());
  }

  /**
   * Get entities by multiple tags (entities must have ALL tags)
   * @param {string[]} tags - Array of tags
   * @returns {Entity[]} - Array of matching entities
   */
  getEntitiesWithAllTags(tags) {
    if (tags.length === 0) return this.getActiveEntities();

    let candidateIds = this.entityTags.get(tags[0]);
    if (!candidateIds) return [];

    for (let i = 1; i < tags.length; i++) {
      const tagIds = this.entityTags.get(tags[i]);
      if (!tagIds) return [];
      
      candidateIds = new Set([...candidateIds].filter(id => tagIds.has(id)));
      
      if (candidateIds.size === 0) return [];
    }

    return Array.from(candidateIds)
      .map(id => this.entities.get(id))
      .filter(entity => entity && entity.isActive());
  }

  /**
   * Mark entity for destruction (will be removed at end of frame)
   * @param {string} entityId - Entity ID
   */
  destroyEntity(entityId) {
    this.entitiesToDestroy.add(entityId);
  }

  /**
   * Process entity destruction queue
   */
  processDestroyQueue() {
    for (const entityId of this.entitiesToDestroy) {
      this.removeEntity(entityId);
    }
    this.entitiesToDestroy.clear();
  }

  /**
   * Update component indices when entity components change
   * @param {Entity} entity - Entity that changed
   */
  updateEntityIndices(entity) {
    this.removeFromComponentIndex(entity);
    this.indexEntityComponents(entity);
  }

  /**
   * Index entity tags for fast lookup
   * @param {Entity} entity - Entity to index
   */
  indexEntityTags(entity) {
    for (const tag of entity.tags) {
      if (!this.entityTags.has(tag)) {
        this.entityTags.set(tag, new Set());
      }
      this.entityTags.get(tag).add(entity.id);
    }
  }

  /**
   * Index entity components for fast lookup
   * @param {Entity} entity - Entity to index
   */
  indexEntityComponents(entity) {
    for (const componentType of entity.components.keys()) {
      if (!this.componentIndex.has(componentType)) {
        this.componentIndex.set(componentType, new Set());
      }
      this.componentIndex.get(componentType).add(entity.id);
    }
  }

  /**
   * Remove entity from all indices
   * @param {Entity} entity - Entity to remove from indices
   */
  removeFromIndices(entity) {
    this.removeFromTagIndex(entity);
    this.removeFromComponentIndex(entity);
  }

  /**
   * Remove entity from tag index
   * @param {Entity} entity - Entity to remove
   */
  removeFromTagIndex(entity) {
    for (const tag of entity.tags) {
      const tagSet = this.entityTags.get(tag);
      if (tagSet) {
        tagSet.delete(entity.id);
        if (tagSet.size === 0) {
          this.entityTags.delete(tag);
        }
      }
    }
  }

  /**
   * Remove entity from component index
   * @param {Entity} entity - Entity to remove
   */
  removeFromComponentIndex(entity) {
    for (const componentType of entity.components.keys()) {
      const componentSet = this.componentIndex.get(componentType);
      if (componentSet) {
        componentSet.delete(entity.id);
        if (componentSet.size === 0) {
          this.componentIndex.delete(componentType);
        }
      }
    }
  }

  /**
   * Update statistics
   */
  updateStats() {
    this.stats.activeEntities = this.getActiveEntities().length;
  }

  /**
   * Get manager statistics
   * @returns {Object} - Statistics object
   */
  getStats() {
    this.updateStats();
    return { ...this.stats };
  }

  /**
   * Clear all entities
   */
  clear() {
    // Destroy all entities
    for (const entity of this.entities.values()) {
      entity.destroy();
    }

    // Clear all collections
    this.entities.clear();
    this.entityTags.clear();
    this.componentIndex.clear();
    this.entitiesToDestroy.clear();

    // Reset stats
    this.stats = {
      totalEntities: 0,
      activeEntities: 0,
      entitiesCreated: 0,
      entitiesDestroyed: 0
    };
  }

  /**
   * Get debug information
   * @returns {Object} - Debug info
   */
  getDebugInfo() {
    return {
      stats: this.getStats(),
      tagIndex: Object.fromEntries(
        Array.from(this.entityTags.entries()).map(([tag, ids]) => [tag, ids.size])
      ),
      componentIndex: Object.fromEntries(
        Array.from(this.componentIndex.entries()).map(([type, ids]) => [type, ids.size])
      ),
      destroyQueue: this.entitiesToDestroy.size
    };
  }
} 