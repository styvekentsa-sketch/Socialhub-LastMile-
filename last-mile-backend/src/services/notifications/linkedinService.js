import { createNotificationChannel } from './createNotificationChannel.js';

// Publication des jalons logistiques sur la page entreprise LinkedIn (API UGC Posts : POST /v2/ugcPosts).
// Variables : LINKEDIN_*.
//
// A connaitre avant activation :
// - Le jeton doit avoir la permission w_organization_social (programme Community Management de LinkedIn)
//   et appartenir a un administrateur de la page.
// - L'auteur est TOUJOURS la page entreprise (urn:li:organization:<id>), jamais un profil personnel.
// - /v2/ugcPosts est l'API historique ; LinkedIn recommande desormais l'API Posts (/rest/posts).
//   Migrer = changer buildRequest ci-dessous, sans toucher au reste.
// - Un post par evenement : par defaut, seules les livraisons reussies sont publiees, pour ne pas
//   saturer le fil de la page (LinkedIn limite aussi le nombre de publications par jour).
export const linkedinChannel = createNotificationChannel({
  name: 'linkedin',
  logPrefix: '[LinkedInChannel]',
  envPrefix: 'LINKEDIN',
  defaultEvents: ['order.delivered'],
  readConfig: () => ({
    apiUrl: process.env.LINKEDIN_API_URL?.trim()?.replace(/\/$/, '') || 'https://api.linkedin.com',
    token: process.env.LINKEDIN_ACCESS_TOKEN?.trim() || '',
    organizationUrn: process.env.LINKEDIN_ORGANIZATION_URN?.trim() || ''
  }),
  validate: ({ token, organizationUrn }) => [
    ...(token ? [] : ['LINKEDIN_ACCESS_TOKEN manquant']),
    ...(/^urn:li:organization:\d+$/.test(organizationUrn) ? [] : ['LINKEDIN_ORGANIZATION_URN doit etre urn:li:organization:<id> (page entreprise uniquement)'])
  ],
  buildRequest: ({ apiUrl, token, organizationUrn }, text) => ({
    url: `${apiUrl}/v2/ugcPosts`,
    init: {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'X-Restli-Protocol-Version': '2.0.0'
      },
      body: JSON.stringify({
        author: organizationUrn,
        lifecycleState: 'PUBLISHED',
        specificContent: {
          'com.linkedin.ugc.ShareContent': {
            shareCommentary: { text },
            shareMediaCategory: 'NONE'
          }
        },
        visibility: { 'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC' }
      })
    }
  })
});
