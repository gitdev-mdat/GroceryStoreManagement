export function resizeAndCompressImage(file, maxSize = 1200, quality = 0.75) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      try {
        let width = img.width
        let height = img.height
        if (width > maxSize || height > maxSize) {
          const ratio = Math.min(maxSize / width, maxSize / height)
          width = Math.round(width * ratio)
          height = Math.round(height * ratio)
        }
        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        ctx.drawImage(img, 0, 0, width, height)
        canvas.toBlob(
          (blob) => {
            if (!blob) return reject(new Error('Không nén được ảnh.'))
            resolve(new File([blob], file.name, { type: 'image/jpeg' }))
          },
          'image/jpeg',
          quality,
        )
      } catch (err) {
        reject(err)
      }
    }
    img.onerror = () => reject(new Error('Không đọc được ảnh để nén.'))
    img.src = URL.createObjectURL(file)
  })
}
