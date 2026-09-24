/**
 * pdfTextExtractor.js
 *
 * Extracts plain text and positional text items from text-based PDF files
 * using pdfjs-dist (v6.x), entirely in the browser.
 *
 * All processing happens locally. PDF files are never uploaded.
 */

import { GlobalWorkerOptions, getDocument } from 'pdfjs-dist/build/pdf.mjs'

// Point the worker to the bundled copy so the app works offline
GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.mjs',
  import.meta.url
).href

// ─────────────────────────────────────────
// Constants
// ─────────────────────────────────────────

/** Minimum non-whitespace characters required to consider a page non-empty. */
const MIN_MEANINGFUL_CHARS = 20

// ─────────────────────────────────────────
// Scanned-PDF detection
// ─────────────────────────────────────────

/**
 * Returns true if the extracted text is so sparse that the page is likely
 * an image-only / scanned page with no OCR layer.
 */
function isScannedLike(pages) {
  if (pages.length === 0) return false

  const totalChars = pages.reduce((sum, p) => {
    return sum + (p.plainText.replace(/\s/g, '').length)
  }, 0)

  if (totalChars < MIN_MEANINGFUL_CHARS) return true

  // Average chars per page — if a multi-page doc averages < 10 chars/page,
  // it's almost certainly scanned
  const avgChars = totalChars / pages.length
  if (pages.length > 1 && avgChars < 10) return true

  return false
}

// ─────────────────────────────────────────
// Progress helper
// ─────────────────────────────────────────

function buildProgress(fileName, currentPage, totalPages) {
  return { fileName, currentPage, totalPages }
}

// ─────────────────────────────────────────
// Main export
// ─────────────────────────────────────────

/**
 * Extract text content and positioning metadata from a single PDF File.
 *
 * @param {File} file               — File object from the browser File input
 * @param {Function} [onProgress]  — Optional callback: (progress) => void
 * @param {AbortSignal} [signal]   — Optional AbortSignal to cancel mid-extraction
 *
 * @returns {Promise<ExtractResult>}
 *
 * @typedef {Object} ExtractResult
 * @property {string}   fileId
 * @property {string}   fileName
 * @property {number}   fileSize
 * @property {number}   pageCount
 * @property {Page[]}   pages
 * @property {number}   totalTextItems
 * @property {string}   fullText
 * @property {'success'|'error'} status
 * @property {PageError[]} warnings  — non-fatal notices (e.g. per-page failures)
 * @property {ErrorDetail|undefined} error  — present only when status === 'error'
 *
 * @typedef {Object} Page
 * @property {number}  pageNumber
 * @property {TextItem[]} textItems
 * @property {string}  plainText
 *
 * @typedef {Object} TextItem
 * @property {string}  text
 * @property {number}  x
 * @property {number}  y
 * @property {number}  width
 * @property {number}  height
 *
 * @typedef {Object} PageError
 * @property {number} pageNumber
 * @property {string} code
 * @property {string} message
 *
 * @typedef {Object} ErrorDetail
 * @property {string} code
 * @property {string} message
 */
export async function extractPdfText(file, { onProgress, signal } = {}) {
  const fileId = `${file.name}__${file.size}__${file.lastModified}__${Date.now()}`
  const fileName = file.name
  const fileSize = file.size

  // getDocument returns a PDFDocumentLoadingTask, NOT a PDFDocumentProxy.
  // We must keep the task reference so we can call task.destroy() below.
  // Calling destroy() on the proxy (PDFDocumentProxy) is a no-op — it does NOT
  // terminate the worker or free resources. Only task.destroy() does that.
  let loadingTask = null
  let doc = null

  try {
    // Read file into an ArrayBuffer
    const buffer = await file.arrayBuffer()
    const uint8 = new Uint8Array(buffer)

    // Create the loading task
    loadingTask = getDocument({ data: uint8 })

    // Load the PDF document proxy
    doc = await loadingTask.promise

    const totalPages = doc.numPages
    const pages = []
    let totalTextItems = 0
    const warnings = []

    // Extract page-by-page
    for (let i = 1; i <= totalPages; i++) {
      if (signal?.aborted) {
        throw Object.assign(new DOMException('Extraction cancelled', 'AbortError'), {
          _cancelled: true,
        })
      }

      try {
        const pdfPage = await doc.getPage(i)
        const textContent = await pdfPage.getTextContent()

        // Extract positional text items
        const textItems = textContent.items.map(item => {
          // transform: [a, b, c, d, e, f] — last two are x/y translation
          const transform = item.transform
          return {
            text: item.str,
            x: transform[4],
            y: transform[5],
            width: item.width,
            height: item.height,
          }
        })

        // Build plain text (items joined with a space; preserves line breaks via items)
        const plainText = textContent.items.map(item => item.str).join(' ')

        pages.push({ pageNumber: i, textItems, plainText })
        totalTextItems += textItems.length
      } catch (pageError) {
        // Non-fatal: record the per-page failure and continue
        warnings.push({
          pageNumber: i,
          code: 'PAGE_EXTRACTION_ERROR',
          message: pageError.message || 'Không đọc được trang này.',
        })
        // Push an empty page so page numbers remain stable
        pages.push({ pageNumber: i, textItems: [], plainText: '' })
      }

      // Report progress after each page
      onProgress?.(buildProgress(fileName, i, totalPages))
    }

    // Assemble full text
    const fullText = pages.map(p => p.plainText).join('\n')

    // Scanned-PDF check
    if (isScannedLike(pages)) {
      return {
        fileId,
        fileName,
        fileSize,
        pageCount: totalPages,
        pages,
        totalTextItems,
        fullText,
        status: 'error',
        error: {
          code: 'SCANNED_PDF',
          message:
            'File này không có nội dung chữ để đọc. Vui lòng chọn file PDF được xuất trực tiếp từ phần mềm, không phải bản scan.',
        },
        warnings,
      }
    }

    return {
      fileId,
      fileName,
      fileSize,
      pageCount: totalPages,
      pages,
      totalTextItems,
      fullText,
      status: 'success',
      warnings,
    }
  } catch (err) {
    // Don't wrap an already-cancelled error
    if (err._cancelled) throw err

    if (err.name === 'AbortError' || err instanceof DOMException) {
      return {
        fileId,
        fileName,
        fileSize,
        pageCount: 0,
        pages: [],
        totalTextItems: 0,
        fullText: '',
        status: 'error',
        error: { code: 'CANCELLED', message: 'Đã hủy.' },
        warnings: [],
      }
    }

    // Password-protected PDF
    if (err.message?.toLowerCase().includes('password')) {
      return {
        fileId,
        fileName,
        fileSize,
        pageCount: 0,
        pages: [],
        totalTextItems: 0,
        fullText: '',
        status: 'error',
        error: {
          code: 'PASSWORD_PROTECTED',
          message: 'File PDF được bảo vệ bằng mật khẩu. Không thể đọc nội dung.',
        },
        warnings: [],
      }
    }

    // Corrupt or invalid PDF
    return {
      fileId,
      fileName,
      fileSize,
      pageCount: 0,
      pages: [],
      totalTextItems: 0,
      fullText: '',
      status: 'error',
      error: {
        code: 'CORRUPT_OR_INVALID',
        message: 'File PDF không hợp lệ hoặc bị hỏng. Vui lòng kiểm tra lại file gốc.',
      },
      warnings: [],
    }
  } finally {
    // Terminate the worker via the loading task (NOT via the proxy).
    // PDFDocumentProxy has no destroy() method; PDFDocumentLoadingTask.destroy()
    // is the only correct way to free resources and stop the worker thread.
    if (loadingTask) {
      await loadingTask.destroy()
    }
  }
}
