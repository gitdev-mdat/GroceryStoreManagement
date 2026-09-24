export const PRODUCT_STATUS = Object.freeze({
  ACTIVE: 'ACTIVE',
  INACTIVE: 'INACTIVE',
})

export async function setProductVisibility(repository, productId, status) {
  if (!productId) throw new Error('PRODUCT_ID_REQUIRED')
  if (!Object.values(PRODUCT_STATUS).includes(status)) throw new Error('INVALID_PRODUCT_STATUS')
  return repository.updateStatus(productId, status)
}

export function createSupabaseProductVisibilityRepository(client) {
  return {
    async updateStatus(productId, status) {
      const result = await client
        .from('products')
        .update({ status })
        .eq('id', productId)
        .select('id, status')
        .single()
      if (result.error) throw result.error
      return result.data
    },
  }
}
