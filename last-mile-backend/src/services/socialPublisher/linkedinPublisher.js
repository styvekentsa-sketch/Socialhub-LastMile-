import { baseUrlFromEnv, requestJson } from './httpClient.js';

// Page entreprise LinkedIn du marchand (API UGC Posts : POST /v2/ugcPosts).
// Publication de type « article » : texte + lien vers la fiche produit (LinkedIn affiche l'apercu du lien).
// Le jeton doit avoir la permission w_organization_social ; l'auteur est TOUJOURS une page (urn:li:organization:...).
// /v2/ugcPosts est l'API historique ; la migration vers /rest/posts ne touchera que cette fonction.
export const publishToLinkedIn = async ({ credentials, post }) => {
  const base = baseUrlFromEnv('SOCIAL_LINKEDIN_API_URL', 'https://api.linkedin.com');
  const { json, headers } = await requestJson(`${base}/v2/ugcPosts`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${credentials.access_token}`,
      'Content-Type': 'application/json',
      'X-Restli-Protocol-Version': '2.0.0'
    },
    body: JSON.stringify({
      author: credentials.organization_urn,
      lifecycleState: 'PUBLISHED',
      specificContent: {
        'com.linkedin.ugc.ShareContent': {
          shareCommentary: { text: post.text },
          shareMediaCategory: 'ARTICLE',
          media: [{ status: 'READY', originalUrl: post.productUrl, title: { text: post.title } }]
        }
      },
      visibility: { 'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC' }
    })
  }, { secrets: [credentials.access_token], platformLabel: 'LinkedIn' });

  return { externalPostId: headers.get('x-restli-id') ?? json?.id ?? null };
};
