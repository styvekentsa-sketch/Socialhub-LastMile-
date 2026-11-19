import { ArrowRight, ChevronLeft, ChevronRight } from 'lucide-react'
import { useRef } from 'react'
import { Link } from 'react-router-dom'
import { useMarketplaceText } from '../i18n.js'
import ProductCard from './ProductCard.jsx'

/** Rangee de produits defilante (boutons precedent / suivant, defilement tactile sur mobile). */
export default function ProductCarousel({ id, title, products, seeAllTo }) {
  const { t } = useMarketplaceText()
  const trackRef = useRef(null)
  const scroll = (direction) => {
    const track = trackRef.current
    if (track) track.scrollBy({ left: direction * track.clientWidth * 0.9, behavior: 'smooth' })
  }

  if (!products?.length) return null

  return (
    <section aria-labelledby={id} className="mk-container py-8">
      <div className="mb-6 flex items-end justify-between gap-4">
        <h2 id={id} className="text-xl font-semibold text-white">{title}</h2>
        <div className="flex items-center gap-2">
          {seeAllTo && <Link to={seeAllTo} className="mr-2 inline-flex items-center gap-1 text-sm text-zinc-400 hover:text-white">{t('homePro.seeAll')}<ArrowRight aria-hidden="true" size={14} /></Link>}
          <button type="button" onClick={() => scroll(-1)} className="hidden size-9 place-items-center rounded-lg border border-zinc-800 text-zinc-400 hover:border-zinc-600 hover:text-white sm:grid" aria-label={t('homePro.previous')}><ChevronLeft aria-hidden="true" size={18} /></button>
          <button type="button" onClick={() => scroll(1)} className="hidden size-9 place-items-center rounded-lg border border-zinc-800 text-zinc-400 hover:border-zinc-600 hover:text-white sm:grid" aria-label={t('homePro.next')}><ChevronRight aria-hidden="true" size={18} /></button>
        </div>
      </div>
      <div ref={trackRef} className="mk-scroll-x -mx-4 flex snap-x snap-mandatory gap-4 px-4 pb-2 md:mx-0 md:px-0">
        {products.map((product) => (
          <div key={product.id} className="w-[46%] shrink-0 snap-start sm:w-[31%] lg:w-[calc((100%-64px)/5)]">
            <ProductCard product={product} />
          </div>
        ))}
      </div>
    </section>
  )
}
