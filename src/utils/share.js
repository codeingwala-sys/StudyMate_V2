import { haptic } from './haptics'

/**
 * Share text/URL using Web Share API or copy to clipboard fallback
 * @param {Object} options - { title, text, url }
 */
export async function shareContent({ title, text, url }) {
  const shareUrl = url || window.location.origin
  const shareData = {
    title: title || 'StudyMate AI',
    text: text || 'Check out StudyMate AI!',
    url: shareUrl
  }

  if (navigator.share && navigator.canShare(shareData)) {
    try {
      await navigator.share(shareData)
      haptic.success()
      return { success: true, method: 'share' }
    } catch (err) {
      if (err.name === 'AbortError') return { success: false, method: 'abort' }
      console.warn('Share API failed, falling back to clipboard', err)
    }
  }

  // Fallback to clipboard
  try {
    const fullText = `${shareData.text}\n\n${shareData.url}`
    await navigator.clipboard.writeText(fullText)
    haptic.success()
    return { success: true, method: 'clipboard' }
  } catch (err) {
    console.error('Clipboard failed', err)
    return { success: false, method: 'none' }
  }
}
