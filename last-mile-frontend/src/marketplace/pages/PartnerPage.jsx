import { ArrowRight, Bike, BadgeCheck, Store } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useMarketplaceText } from '../i18n.js'
import usePageTitle from '../usePageTitle.js'

// role : 'merchant' (/devenir-vendeur), 'driver' (/devenir-livreur) ou absent (/devenir-partenaire)
const ROLES = {
  merchant: { icon: Store, path: '/devenir-vendeur', register: '/register?role=merchant' },
  driver: { icon: Bike, path: '/devenir-livreur', register: '/register?role=driver' },
}

const primaryButton = 'inline-flex h-11 items-center gap-2 rounded-lg bg-amber-500 px-5 text-sm font-semibold text-zinc-950 transition-colors hover:bg-amber-400'
const secondaryButton = 'inline-flex h-11 items-center rounded-lg border border-zinc-700 px-5 text-sm font-semibold text-white transition-colors hover:border-zinc-500'

function PartnerOverview() {
  const { t } = useMarketplaceText()
  usePageTitle(t('partner.overviewPageTitle'))

  return (
    <div className="mk-container py-16">
      <h1 className="text-4xl font-semibold text-white">{t('partner.overviewTitle')}</h1>
      <p className="mt-4 max-w-2xl text-base text-zinc-400">{t('partner.overviewText')}</p>
      <div className="mt-12 grid gap-4 md:grid-cols-2 lg:gap-6">
        {Object.entries(ROLES).map(([role, { icon: Icon, path }]) => (
          <Link key={role} to={path} className="group flex flex-col rounded-lg border border-zinc-800 p-6 transition-colors hover:border-zinc-600">
            <span className="grid size-10 place-items-center rounded-lg border border-zinc-800 text-amber-500"><Icon aria-hidden="true" size={20} /></span>
            <h2 className="mt-4 text-xl font-semibold text-white">{t(`partner.${role}.cardTitle`)}</h2>
            <p className="mt-2 flex-1 text-sm text-zinc-400">{t(`partner.${role}.cardText`)}</p>
            <span className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-white">
              {t('partner.learnMore')}
              <ArrowRight aria-hidden="true" size={16} className="transition-transform group-hover:translate-x-0.5" />
            </span>
          </Link>
        ))}
      </div>
    </div>
  )
}

function PartnerRolePage({ role }) {
  const { t } = useMarketplaceText()
  const { icon: Icon, register } = ROLES[role]
  const benefits = t(`partner.${role}.benefits`)
  const steps = t(`partner.${role}.steps`)
  usePageTitle(t(`partner.${role}.pageTitle`))

  return (
    <>
      <section className="border-b border-zinc-800">
        <div className="mk-container grid gap-8 py-16 lg:grid-cols-12 lg:py-24">
          <div className="lg:col-span-8">
            <p className="flex items-center gap-2 text-sm font-semibold text-amber-500">
              <Icon aria-hidden="true" size={16} />
              {t(`partner.${role}.eyebrow`)}
            </p>
            <h1 className="mt-4 text-4xl font-semibold leading-tight text-white md:text-5xl">{t(`partner.${role}.title`)}</h1>
            <p className="mt-4 max-w-2xl text-base text-zinc-400 md:text-lg">{t(`partner.${role}.text`)}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to={register} className={primaryButton}>
                {t(`partner.${role}.cta`)}
                <ArrowRight aria-hidden="true" size={16} />
              </Link>
              <Link to="/login" className={secondaryButton}>{t('partner.haveAccount')}</Link>
            </div>
          </div>
        </div>
      </section>

      <section className="mk-container py-16" aria-labelledby="mk-benefits-title">
        <h2 id="mk-benefits-title" className="mb-8 text-xl font-semibold text-white">{t('partner.benefitsTitle')}</h2>
        <div className="grid gap-px overflow-hidden rounded-lg border border-zinc-800 bg-zinc-800 md:grid-cols-2">
          {benefits.map(([title, text]) => (
            <div key={title} className="bg-[var(--mk-bg)] p-6">
              <BadgeCheck aria-hidden="true" size={20} className="text-amber-500" />
              <h3 className="mt-4 text-base font-semibold text-white">{title}</h3>
              <p className="mt-2 text-sm text-zinc-400">{text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="border-t border-zinc-800" aria-labelledby="mk-steps-title">
        <div className="mk-container py-16">
          <h2 id="mk-steps-title" className="mb-8 text-xl font-semibold text-white">{t('partner.howItWorks')}</h2>
          <ol className="grid gap-4 md:grid-cols-3 lg:gap-6">
            {steps.map(([title, text], index) => (
              <li key={title} className="rounded-lg border border-zinc-800 p-6">
                <span className="text-sm font-semibold tabular-nums text-zinc-500">{String(index + 1).padStart(2, '0')}</span>
                <h3 className="mt-2 text-base font-semibold text-white">{title}</h3>
                <p className="mt-2 text-sm text-zinc-400">{text}</p>
              </li>
            ))}
          </ol>
          <div className="mt-12 flex flex-wrap gap-3">
            <Link to={register} className={primaryButton}>
              {t(`partner.${role}.cta`)}
              <ArrowRight aria-hidden="true" size={16} />
            </Link>
          </div>
        </div>
      </section>
    </>
  )
}

export default function PartnerPage({ role }) {
  return ROLES[role] ? <PartnerRolePage key={role} role={role} /> : <PartnerOverview />
}
