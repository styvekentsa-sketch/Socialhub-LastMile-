import { Briefcase, Camera, MessageCircle, Send, Users } from 'lucide-react'

// Plateformes de publication du marchand (memes champs que le backend : services/socialPublisher/platforms.js).
// secret : champ masque, jamais reaffiche en clair ; vide en modification = valeur actuelle conservee.
export const SOCIAL_PLATFORMS = {
  whatsapp: {
    label: 'WhatsApp (Whapi)',
    icon: MessageCircle,
    fields: [
      { name: 'token', secret: true, placeholder: 'Jeton API Whapi.cloud' },
      { name: 'channel_id', placeholder: '120363000000000000@newsletter' },
    ],
  },
  telegram: {
    label: 'Telegram',
    icon: Send,
    fields: [
      { name: 'bot_token', secret: true, placeholder: '123456789:AAH…' },
      { name: 'chat_id', placeholder: '@ma_boutique' },
    ],
  },
  facebook: {
    label: 'Facebook',
    icon: Users,
    fields: [
      { name: 'page_id', placeholder: '1234567890' },
      { name: 'page_access_token', secret: true, placeholder: 'EAAB…' },
    ],
  },
  instagram: {
    label: 'Instagram',
    icon: Camera,
    fields: [
      { name: 'ig_user_id', placeholder: '17841400000000000' },
      { name: 'access_token', secret: true, placeholder: 'EAAB…' },
    ],
  },
  linkedin: {
    label: 'LinkedIn',
    icon: Briefcase,
    fields: [
      { name: 'organization_urn', placeholder: 'urn:li:organization:12345' },
      { name: 'access_token', secret: true, placeholder: 'AQV…' },
    ],
  },
}

export const SOCIAL_PLATFORM_NAMES = Object.keys(SOCIAL_PLATFORMS)
