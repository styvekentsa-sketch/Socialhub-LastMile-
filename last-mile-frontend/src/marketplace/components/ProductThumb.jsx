import { Package } from 'lucide-react'
import { useState } from 'react'

/** Vignette produit : remplit son conteneur (position relative), icone neutre si l'image manque ou echoue. */
export default function ProductThumb({ src, iconSize = 20 }) {
  const [failedSrc, setFailedSrc] = useState(null)

  if (!src || failedSrc === src) {
    return <Package aria-hidden="true" size={iconSize} className="absolute inset-0 m-auto text-zinc-600" />
  }
  return <img src={src} alt="" loading="lazy" onError={() => setFailedSrc(src)} className="absolute inset-0 size-full object-cover" />
}
