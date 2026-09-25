/**
 * @typedef {Object} MeshNode
 * @property {number} id - Node ID
 * @property {number} x - X coordinate
 * @property {number} y - Y coordinate
 * @property {number} z - Z coordinate
 */

/**
 * @typedef {Object} MeshElement
 * @property {number} id - Element ID
 * @property {number} type - Element type (1=line, 2=triangle, 3=quad, 4=tetrahedron)
 * @property {number[]} nodes - Array of node IDs that form this element
 */

/**
 * @typedef {Object} MeshBounds
 * @property {number} minX
 * @property {number} maxX
 * @property {number} minY
 * @property {number} maxY
 * @property {number} minZ
 * @property {number} maxZ
 */

/**
 * @typedef {Object} MeshData
 * @property {Map<number, MeshNode>} nodes - Map of node ID to node data
 * @property {MeshElement[]} elements - Array of mesh elements
 * @property {MeshBounds} bounds - Bounding box of the mesh
 * @property {Object} [metadata] - Optional metadata
 */

export default {};
