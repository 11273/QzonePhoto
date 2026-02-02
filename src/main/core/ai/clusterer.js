import logger from '@main/core/logger'

/**
 * 计算两个向量的余弦相似度
 * 范围: -1 到 1 (1表示完全相同, 0表示无关, -1表示相反)
 * 人脸识别中通常只关注 0 到 1
 */
function cosineSimilarity(v1, v2) {
  if (!v1 || !v2 || v1.length !== v2.length) return 0

  let dotProduct = 0
  let normA = 0
  let normB = 0

  for (let i = 0; i < v1.length; i++) {
    dotProduct += v1[i] * v2[i]
    normA += v1[i] * v1[i]
    normB += v2[i] * v2[i]
  }

  if (normA === 0 || normB === 0) return 0

  // 相似度 = 点积 / (模A * 模B)
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB))
}

/**
 * 计算一组向量的平均值 (更新质心)
 * @param {Array<number[]>} vectors
 * @returns {number[]}
 */
function calculateCentroid(vectors) {
  if (vectors.length === 0) return []
  const dim = vectors[0].length
  const centroid = new Array(dim).fill(0)

  // 累加
  for (const vec of vectors) {
    for (let i = 0; i < dim; i++) {
      centroid[i] += vec[i]
    }
  }

  // 平均
  for (let i = 0; i < dim; i++) {
    centroid[i] /= vectors.length
  }

  return centroid
}

export const Clusterer = {
  /**
   * 优化后的聚类算法 (Centroid-based)
   * @param {Array} photos 照片列表
   * @param {number} threshold 相似度阈值 (注意：这是相似度，不是距离)
   * 建议范围: 0.6 (严格) - 0.4 (宽松)
   * 注：这里用的是 1 - similarity 作为距离，
   * 所以 threshold 设为 0.4 意味着相似度 > 0.6 才算同一人
   */
  cluster(photos, threshold = 0.4) {
    logger.info(`[Clusterer] 开始聚类, 照片总数: ${photos.length}`)

    // 结构: { id, centroid: [], members: [], embeddings: [] }
    const clusters = []
    let nextGroupId = 1

    for (const photo of photos) {
      if (!photo.faces) continue

      let faces = []
      try {
        faces = typeof photo.faces === 'string' ? JSON.parse(photo.faces) : photo.faces
      } catch {
        continue
      }

      if (!Array.isArray(faces)) continue

      for (let i = 0; i < faces.length; i++) {
        const face = faces[i]
        // Human 库输出的 embedding 有时是 Float32Array，转为普通数组更安全
        const currentEmbedding = Array.from(face.embedding)

        let bestMatchIndex = -1
        let maxSimilarity = -1

        // 1. 寻找最相似的现有分组
        for (let cIdx = 0; cIdx < clusters.length; cIdx++) {
          const cluster = clusters[cIdx]

          // 使用余弦相似度
          const similarity = cosineSimilarity(currentEmbedding, cluster.centroid)

          // 记录最像的那个组
          if (similarity > maxSimilarity) {
            maxSimilarity = similarity
          }

          // 判定：如果相似度高于阈值 (注意：相似度越高越好，距离是 1-相似度)
          // 假设我们传入的 threshold 是 "最小允许相似度" 比如 0.6
          // 为了兼容你的习惯，如果 threshold 是 0.4 (距离阈值)，则要求 similarity > (1 - 0.4) = 0.6
          const minSimilarityRequired = 1 - threshold

          if (similarity > minSimilarityRequired && similarity === maxSimilarity) {
            bestMatchIndex = cIdx
          }
        }

        if (bestMatchIndex !== -1) {
          // === 情况 A: 找到了组织 ===
          const targetCluster = clusters[bestMatchIndex]

          // 加入成员
          targetCluster.members.push({ path: photo.path, index: i, face })
          targetCluster.embeddings.push(currentEmbedding)

          // 【关键优化】重新计算这个组的质心 (平均脸)
          // 这样这个组的特征会随着照片增多而越来越准确
          targetCluster.centroid = calculateCentroid(targetCluster.embeddings)
        } else {
          // === 情况 B: 没找到，自立门户 ===
          clusters.push({
            id: `person_${nextGroupId++}`,
            centroid: currentEmbedding, // 初始质心就是自己
            embeddings: [currentEmbedding], // 存下所有原始向量用于重算质心
            members: [{ path: photo.path, index: i, face }],
            metadata: {
              gender: face.gender, // 简单取第一个人的属性
              age: face.age
            }
          })
        }
      }
    }

    logger.info(`[Clusterer] 聚类完成, 发现人物总数: ${clusters.length}`)

    // 清理一下内存，把 embeddings 大数组删掉，只留 members 和 centroid
    return clusters.map((c) => ({
      id: c.id,
      members: c.members,
      metadata: c.metadata,
      faceCount: c.members.length
      // centroid 也可以去掉，除非前端要用
    }))
  }
}
